import type { FormField, FormSchema, FormValues, ShowIf } from './types'

interface DynamicFormProps {
  schema: FormSchema
  values: FormValues
  onChange: (key: string, value: unknown) => void
  readOnly?: boolean
}

function visivel(showIf: ShowIf | undefined, values: FormValues): boolean {
  if (!showIf) return true
  const v = values[showIf.field]
  if (showIf.truthy) return Boolean(v)
  return v === showIf.equals
}

const inputCls =
  'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primaria disabled:bg-black/5'

function Field({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: FormField
  value: unknown
  onChange: (v: unknown) => void
  readOnly?: boolean
}) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          className={inputCls}
          rows={3}
          disabled={readOnly}
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'number':
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            className={inputCls}
            disabled={readOnly}
            placeholder={field.placeholder}
            value={(value as number | string) ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          />
          {field.suffix && <span className="text-sm text-texto/50">{field.suffix}</span>}
        </div>
      )
    case 'date':
      return (
        <input
          type="date"
          className={inputCls}
          disabled={readOnly}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'boolean':
      return (
        <div className="flex gap-4 py-1">
          {[
            { v: true, l: 'Sim' },
            { v: false, l: 'Não' },
          ].map((o) => (
            <label key={o.l} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                disabled={readOnly}
                checked={value === o.v}
                onChange={() => onChange(o.v)}
              />
              {o.l}
            </label>
          ))}
        </div>
      )
    case 'radio':
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 py-1">
          {field.options?.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                disabled={readOnly}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      )
    case 'select':
      return (
        <select
          className={inputCls}
          disabled={readOnly}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecione…</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'multiselect': {
      const arr = Array.isArray(value) ? (value as string[]) : []
      const toggle = (v: string) =>
        onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 py-1">
          {field.options?.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={arr.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      )
    }
    case 'grid': {
      const cfg = field.grid
      if (!cfg) return null
      const data = (value as Record<string, Record<string, string>>) ?? {}
      const setCell = (row: string, col: string, v: string) =>
        onChange({ ...data, [row]: { ...(data[row] ?? {}), [col]: v } })
      return (
        <div className="overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.03] text-left text-texto/60">
              <tr>
                <th className="px-3 py-2 font-medium">Região</th>
                {cfg.columns.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cfg.rows.map((row) => (
                <tr key={row} className="border-t border-black/5">
                  <td className="px-3 py-1.5 text-texto/80">{row}</td>
                  {cfg.columns.map((c) => (
                    <td key={c.key} className="px-2 py-1">
                      <input
                        type="number"
                        disabled={readOnly}
                        value={data[row]?.[c.key] ?? ''}
                        onChange={(e) => setCell(row, c.key, e.target.value)}
                        className="w-24 rounded border border-black/10 px-2 py-1 text-sm outline-none focus:border-primaria disabled:bg-black/5"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    default:
      return (
        <input
          className={inputCls}
          disabled={readOnly}
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

export default function DynamicForm({ schema, values, onChange, readOnly }: DynamicFormProps) {
  return (
    <div className="space-y-6">
      {schema.sections.map((section) => (
        <section key={section.title} className="rounded-xl border border-black/5 bg-white p-5">
          <h3 className="font-semibold text-texto">{section.title}</h3>
          {section.description && (
            <p className="mt-0.5 text-xs text-texto/50">{section.description}</p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {section.fields
              .filter((f) => visivel(f.showIf, values))
              .map((f) => (
                <div
                  key={f.key}
                  className={f.full || f.type === 'textarea' || f.type === 'grid' ? 'sm:col-span-2' : ''}
                >
                  <label className="mb-1 block text-sm font-medium text-texto/80">{f.label}</label>
                  <Field
                    field={f}
                    value={values[f.key]}
                    onChange={(v) => onChange(f.key, v)}
                    readOnly={readOnly}
                  />
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
