import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { supabaseServer } from "@/lib/supabase-server"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Correo y contraseña son obligatorios" },
        { status: 400 }
      )
    }

    const emailLimpo = String(email).trim().toLowerCase()

    // Buscar usuário admin
    const { data: admin, error } = await supabaseServer
      .from("admin_users")
      .select("id, email, password_hash, nombre, rol, activo")
      .eq("email", emailLimpo)
      .single()

    if (error || !admin) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      )
    }

    if (!admin.activo) {
      return NextResponse.json(
        { error: "Usuario inactivo" },
        { status: 403 }
      )
    }

    // Comparar senha com hash
    const passwordOk = await bcrypt.compare(password, admin.password_hash)

    if (!passwordOk) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      )
    }

    // Criar resposta
    const response = NextResponse.json({
      ok: true,
      user: {
        id: admin.id,
        email: admin.email,
        nombre: admin.nombre,
        rol: admin.rol,
      },
    })

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 12, // 12h
    }

    // Sessão
    response.cookies.set("admin_session", "ok", cookieOptions)

    // Informações do usuário
    response.cookies.set("admin_email", admin.email, cookieOptions)
    response.cookies.set(
      "admin_nombre",
      encodeURIComponent(admin.nombre),
      cookieOptions
    )
    response.cookies.set("admin_rol", admin.rol, cookieOptions)
    response.cookies.set("admin_user_id", admin.id, cookieOptions)

    return response
  } catch (error) {
    console.error("Erro no login admin:", error)

    return NextResponse.json(
      { error: "Error interno al iniciar sesión" },
      { status: 500 }
    )
  }
}