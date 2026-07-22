'use client';

import { CalendarDays, Check, ChevronDown, Filter, RotateCcw, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { TradingAccount } from '@/features/accounts/types';
import { accountTypeLabel } from '@/features/accounts/domain';
import { cn } from '@/lib/utils';
import { EMPTY_DASHBOARD_FILTERS } from '../projection';
import type { DashboardFilters, DateRangePreset } from '../types';

const DATE_RANGES: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

function toggle<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function activeCount(filters: DashboardFilters): number {
  return (
    filters.accountIds.length +
    filters.accountTypes.length +
    filters.symbols.length +
    filters.sides.length +
    filters.sources.length +
    Number(filters.result !== 'all') +
    Number(filters.dateRange !== 'all')
  );
}

export function DashboardFiltersBar({
  accounts,
  symbols,
  filters,
  onChange,
}: {
  accounts: TradingAccount[];
  symbols: string[];
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}) {
  const selectedAccountLabel =
    filters.accountIds.length === 0
      ? 'All accounts'
      : filters.accountIds.length === 1
        ? accounts.find((account) => account.id === filters.accountIds[0])?.name || '1 account'
        : `${filters.accountIds.length} accounts`;
  const dateLabel =
    DATE_RANGES.find((range) => range.value === filters.dateRange)?.label || 'Date range';
  const count = activeCount(filters);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 min-w-40 justify-between bg-card font-normal">
            <span className="flex items-center gap-2">
              <WalletCards className="size-4 text-primary" aria-hidden />
              {selectedAccountLabel}
            </span>
            <ChevronDown className="size-3.5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Accounts</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...filters, accountIds: [], accountTypes: [] })}
            >
              All
            </Button>
          </div>
          {accounts.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Create an account to filter performance.
            </p>
          ) : (
            <div className="space-y-1">
              {accounts.map((account) => (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={filters.accountIds.includes(account.id)}
                    onCheckedChange={() =>
                      onChange({ ...filters, accountIds: toggle(filters.accountIds, account.id) })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{account.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {accountTypeLabel(account.account_type)} · {account.base_currency}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Account type</p>
            <div className="flex flex-wrap gap-1.5">
              {(['broker', 'demo', 'funded'] as const).map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={filters.accountTypes.includes(type) ? 'default' : 'outline'}
                  onClick={() =>
                    onChange({ ...filters, accountTypes: toggle(filters.accountTypes, type) })
                  }
                >
                  {accountTypeLabel(type)}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 min-w-36 justify-between bg-card font-normal">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" aria-hidden />
              {dateLabel}
            </span>
            <ChevronDown className="size-3.5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2">
          {DATE_RANGES.map((range) => (
            <button
              key={range.value}
              type="button"
              onClick={() => onChange({ ...filters, dateRange: range.value })}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span>{range.label}</span>
              {filters.dateRange === range.value ? (
                <Check className="size-4 text-primary" aria-hidden />
              ) : null}
            </button>
          ))}
          {filters.dateRange === 'custom' ? (
            <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
              <label className="text-xs text-muted-foreground">
                From
                <input
                  aria-label="Custom range start"
                  type="date"
                  value={filters.customStart || ''}
                  onChange={(event) =>
                    onChange({ ...filters, customStart: event.target.value || null })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                To
                <input
                  aria-label="Custom range end"
                  type="date"
                  value={filters.customEnd || ''}
                  onChange={(event) =>
                    onChange({ ...filters, customEnd: event.target.value || null })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                />
              </label>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 bg-card font-normal">
            <Filter className="size-4 text-primary" aria-hidden />
            Filters
            {count > 0 ? (
              <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {count}
              </span>
            ) : null}
            <ChevronDown className="size-3.5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Trading filters</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...EMPTY_DASHBOARD_FILTERS })}
            >
              <RotateCcw className="size-3.5" aria-hidden /> Reset
            </Button>
          </div>
          <FilterGroup
            label="Result"
            options={[
              ['all', 'All results'],
              ['profitable', 'Profitable'],
              ['losing', 'Losing'],
              ['break_even', 'Break-even'],
            ]}
            selected={[filters.result]}
            onSelect={(value) =>
              onChange({ ...filters, result: value as DashboardFilters['result'] })
            }
            single
          />
          <FilterGroup
            label="Side"
            options={[
              ['buy', 'Buy'],
              ['sell', 'Sell'],
            ]}
            selected={filters.sides}
            onSelect={(value) =>
              onChange({ ...filters, sides: toggle(filters.sides, value as 'buy' | 'sell') })
            }
          />
          <FilterGroup
            label="Source"
            options={[
              ['manual', 'Manual'],
              ['imported', 'Imported'],
            ]}
            selected={filters.sources}
            onSelect={(value) =>
              onChange({
                ...filters,
                sources: toggle(filters.sources, value as 'manual' | 'imported'),
              })
            }
          />
          {symbols.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Symbols</p>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {symbols.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() =>
                      onChange({ ...filters, symbols: toggle(filters.symbols, symbol) })
                    }
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs',
                      filters.symbols.includes(symbol)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onSelect,
  single = false,
}: {
  label: string;
  options: string[][];
  selected: string[];
  onSelect: (value: string) => void;
  single?: boolean;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([value, text]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={selected.includes(value!) ? 'default' : 'outline'}
            onClick={() => onSelect(value!)}
            aria-pressed={selected.includes(value!)}
          >
            {text}
            {single && selected.includes(value!) ? <Check className="size-3" aria-hidden /> : null}
          </Button>
        ))}
      </div>
    </div>
  );
}
