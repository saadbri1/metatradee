'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, EyeOff, LayoutGrid, Plus, RotateCcw, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  canHideDashboardWidget,
  DASHBOARD_WIDGETS,
  moveDashboardWidget,
  widgetDefinition,
  type DashboardWidgetId,
  type DashboardWidgetLayout,
} from '../widget-preferences';

export type WidgetEditorProps = {
  layout: DashboardWidgetLayout;
  onHide: (id: DashboardWidgetId) => void;
  onMove: (id: DashboardWidgetId, direction: 'up' | 'down') => void;
};

/**
 * Per-widget move/hide controls. Rendered inside the widget frame so the
 * controls travel with the widget as it is reordered.
 */
export function WidgetEditorControls({
  id,
  editor,
}: {
  id: DashboardWidgetId;
  editor: WidgetEditorProps;
}) {
  const label = widgetDefinition(id).label;
  const canMoveUp = moveDashboardWidget(editor.layout, id, 'up') !== editor.layout;
  const canMoveDown = moveDashboardWidget(editor.layout, id, 'down') !== editor.layout;
  const canHide = canHideDashboardWidget(editor.layout, id);
  const hideReason = canHide
    ? `Hide ${label}`
    : `${label} cannot be hidden because it is the last visible widget`;

  return (
    <div
      className="mb-2 flex items-center justify-end gap-1"
      aria-label={`${label} widget controls`}
      data-widget-controls
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8"
        aria-label={`Move ${label} up`}
        title={`Move ${label} up`}
        disabled={!canMoveUp}
        onClick={() => editor.onMove(id, 'up')}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8"
        aria-label={`Move ${label} down`}
        title={`Move ${label} down`}
        disabled={!canMoveDown}
        onClick={() => editor.onMove(id, 'down')}
      >
        <ArrowDown className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 text-muted-foreground hover:text-foreground"
        aria-label={hideReason}
        title={hideReason}
        disabled={!canHide}
        onClick={() => editor.onHide(id)}
      >
        <EyeOff className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/**
 * A stable wrapper around every configurable widget.
 *
 * The element is rendered identically whether or not editing is active — only
 * its styling and the presence of the controls change — so entering or leaving
 * edit mode never remounts the widget. That keeps each widget's internal state
 * (chart tab, positions tab, calendar month) intact across an edit session.
 */
export function EditableWidgetFrame({
  id,
  editor,
  className,
  children,
}: {
  id: DashboardWidgetId;
  editor?: WidgetEditorProps;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'min-w-0',
        className,
        editor &&
          'rounded-md border border-primary/40 bg-primary/[0.025] p-2 ring-1 ring-primary/10',
      )}
      data-widget-id={id}
      data-widget-editing={editor ? 'true' : undefined}
    >
      {editor ? <WidgetEditorControls id={id} editor={editor} /> : null}
      {children}
    </div>
  );
}

/** The toolbar shown while editing: Restore defaults, Cancel, Save changes. */
export function WidgetEditorToolbar({
  onRestoreDefaults,
  onCancel,
  onSave,
  isSaving,
}: {
  onRestoreDefaults: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <section
      aria-label="Dashboard widget editor"
      className="flex flex-col gap-3 rounded-md border border-primary/40 bg-primary/[0.035] p-3 ring-1 ring-primary/10 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <LayoutGrid className="size-4 text-primary" aria-hidden /> Editing dashboard
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Changes stay private until you save them.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onRestoreDefaults}>
          <RotateCcw aria-hidden /> Restore defaults
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          <X aria-hidden /> Cancel
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={isSaving}>
          <Save aria-hidden /> {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </section>
  );
}

/** Compact surface listing hidden widgets so each one can be restored. */
export function AvailableWidgets({
  hidden,
  onShow,
}: {
  hidden: DashboardWidgetId[];
  onShow: (id: DashboardWidgetId) => void;
}) {
  return (
    <section
      className="rounded-md border border-dashed border-border bg-card/70 p-3"
      aria-labelledby="available-widgets-title"
    >
      <h2 id="available-widgets-title" className="text-sm font-semibold">
        Available widgets
      </h2>
      {hidden.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {DASHBOARD_WIDGETS.filter((widget) => hidden.includes(widget.id)).map((widget) => (
            <Button
              key={widget.id}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onShow(widget.id)}
              aria-label={`Show ${widget.label}`}
            >
              <Plus aria-hidden /> {widget.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">All Dashboard widgets are visible.</p>
      )}
    </section>
  );
}
