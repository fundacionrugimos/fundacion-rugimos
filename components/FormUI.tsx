export function Section({ title, children }: any) {
  return (
    <div className="rounded-[24px] bg-[#f4f4f4] p-6 shadow-lg">
      <h2 className="text-xl font-bold text-[#0b6665] mb-4">{title}</h2>
      {children}
    </div>
  )
}

export function Field({ label, children }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}

export function Input(props: any) {
  return (
    <input
      {...props}
      className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7a75] bg-white"
    />
  )
}

export function Select(props: any) {
  return (
    <select
      {...props}
      className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7a75] bg-white"
    />
  )
}

export function Textarea(props: any) {
  return (
    <textarea
      {...props}
      className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7a75] bg-white"
    />
  )
}