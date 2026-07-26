import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import { RuleGroupEditor, ChecklistEditor } from '@/features/playbook/components/rule-group-editor';
import type { StrategyCreateInput } from '@/features/playbook/schemas';

// jsdom ships no ResizeObserver; Radix's checkbox observes its indicator. This
// is a jsdom gap, not a product defect.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

/**
 * A minimal host that exposes the form's real submitted values, so each test
 * asserts what would actually be PERSISTED — not just what is on screen.
 */
function Host({
  onSubmit,
  kind = 'rules',
  defaults,
}: {
  onSubmit: (values: unknown) => void;
  kind?: 'rules' | 'checklist';
  defaults?: Partial<StrategyCreateInput>;
}) {
  const form = useForm<StrategyCreateInput>({
    defaultValues: { entry_rules: [], checklist: [], ...defaults } as StrategyCreateInput,
  });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {kind === 'rules' ? (
        <RuleGroupEditor
          control={form.control}
          name="entry_rules"
          legend="Entry"
          help="What must be true before you take the trade."
        />
      ) : (
        <ChecklistEditor control={form.control} name="checklist" />
      )}
      <button type="submit">Save</button>
    </form>
  );
}

async function addRule(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('button', { name: /add rule/i }));
  const inputs = screen.getAllByRole('textbox');
  await user.type(inputs[inputs.length - 1]!, text);
}

describe('rule editor', () => {
  it('shows help text that frames rules as review criteria, not automation', () => {
    render(<Host onSubmit={vi.fn()} />);
    expect(screen.getByText(/what must be true before you take the trade/i)).toBeInTheDocument();
    expect(screen.getByText(/no rules yet/i)).toBeInTheDocument();
  });

  it('adds a rule and persists its text', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} />);

    await addRule(user, 'Price sweeps liquidity');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        entry_rules: [expect.objectContaining({ text: 'Price sweeps liquidity' })],
      }),
      expect.anything(),
    );
  });

  it('edits an existing rule', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Host
        onSubmit={onSubmit}
        defaults={
          {
            entry_rules: [{ id: 'r1', text: 'Old text', required: false }],
          } as Partial<StrategyCreateInput>
        }
      />,
    );

    const input = screen.getByRole('textbox', { name: /entry rule 1/i });
    await user.clear(input);
    await user.type(input, 'New text');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      entry_rules: [{ id: 'r1', text: 'New text' }],
    });
  });

  it('actually writes the Required flag to form state', async () => {
    // Regression: the previous editor dispatched a synthetic change that never
    // reached the form, so "Required" looked ticked but always saved as false.
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} />);

    await addRule(user, 'HTF bias confirmed');
    await user.click(screen.getByRole('checkbox', { name: /entry rule 1 is required/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      entry_rules: [{ text: 'HTF bias confirmed', required: true }],
    });
  });

  it('deletes the correct rule, not merely the last one', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} />);

    await addRule(user, 'First');
    await addRule(user, 'Second');
    await addRule(user, 'Third');
    await user.click(screen.getByRole('button', { name: /delete entry rule 2/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit.mock.calls[0]![0].entry_rules.map((r: { text: string }) => r.text)).toEqual([
      'First',
      'Third',
    ]);
  });

  it('reorders rules with Move up / Move down and persists the new order', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} />);

    await addRule(user, 'Alpha');
    await addRule(user, 'Beta');

    await user.click(screen.getByRole('button', { name: /move entry rule 2 up/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit.mock.calls[0]![0].entry_rules.map((r: { text: string }) => r.text)).toEqual([
      'Beta',
      'Alpha',
    ]);

    await user.click(screen.getByRole('button', { name: /move entry rule 1 down/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit.mock.calls[1]![0].entry_rules.map((r: { text: string }) => r.text)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('offers a keyboard alternative to dragging, with the ends correctly disabled', async () => {
    const user = userEvent.setup();
    render(<Host onSubmit={vi.fn()} />);
    await addRule(user, 'Only');

    // A single rule cannot move in either direction.
    expect(screen.getByRole('button', { name: /move entry rule 1 up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move entry rule 1 down/i })).toBeDisabled();

    await addRule(user, 'Second');
    expect(screen.getByRole('button', { name: /move entry rule 1 up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move entry rule 1 down/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /move entry rule 2 up/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /move entry rule 2 down/i })).toBeDisabled();
  });

  it('moves rules using only the keyboard', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} />);
    await addRule(user, 'One');
    await addRule(user, 'Two');

    screen.getByRole('button', { name: /move entry rule 2 up/i }).focus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit.mock.calls[0]![0].entry_rules.map((r: { text: string }) => r.text)).toEqual([
      'Two',
      'One',
    ]);
  });
});

describe('checklist editor', () => {
  it('keeps checklist items ordered and numbered', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} kind="checklist" />);

    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.type(screen.getByRole('textbox', { name: /checklist item 1/i }), 'Risk under 1%');
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.type(screen.getByRole('textbox', { name: /checklist item 2/i }), 'Killzone timing');

    await user.click(screen.getByRole('button', { name: /move checklist item 2 up/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit.mock.calls[0]![0].checklist.map((c: { text: string }) => c.text)).toEqual([
      'Killzone timing',
      'Risk under 1%',
    ]);
  });

  it('defaults checklist items to required and lets that be turned off', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} kind="checklist" />);

    await user.click(screen.getByRole('button', { name: /add item/i }));
    const checkbox = screen.getByRole('checkbox', { name: /checklist item 1 is required/i });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit.mock.calls[0]![0].checklist[0]).toMatchObject({ required: false });
  });

  it('gives every control an accessible name, so none is a mystery icon', async () => {
    const user = userEvent.setup();
    render(<Host onSubmit={vi.fn()} kind="checklist" />);
    await user.click(screen.getByRole('button', { name: /add item/i }));

    const fieldset = screen.getByRole('group', { name: /pre-trade checklist/i });
    for (const control of within(fieldset).getAllByRole('button')) {
      expect(control).toHaveAccessibleName();
    }
  });
});
