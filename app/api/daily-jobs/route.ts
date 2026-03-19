import { NextResponse } from "next/server"

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

    const resultados = []

    const noShow = await fetch(`${baseUrl}/api/admin/no-show`)
    resultados.push({
      job: "no-show",
      status: noShow.status,
      body: await noShow.text(),
    })

    const reminder = await fetch(`${baseUrl}/api/reminder-24h`)
    resultados.push({
      job: "reminder-24h",
      status: reminder.status,
      body: await reminder.text(),
    })

    const postCirugia = await fetch(`${baseUrl}/api/post-cirugia`)
    resultados.push({
      job: "post-cirugia",
      status: postCirugia.status,
      body: await postCirugia.text(),
    })

    return NextResponse.json({
      ok: true,
      resultados,
    })
  } catch (error) {
    console.error("daily-jobs error:", error)
    return NextResponse.json(
      { ok: false, error: "error interno" },
      { status: 500 }
    )
  }
}