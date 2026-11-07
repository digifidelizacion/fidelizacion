// ===== Elementos de la página =====
const mensaje = document.getElementById("mensaje");
const formIngresar = document.getElementById("formIngresar");
const formRegistro = document.getElementById("formRegistro");
const tabIngresar = document.getElementById("tabIngresar");
const tabRegistro = document.getElementById("tabRegistro");

function mostrar(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.className = "mensaje " + tipo;
}

function traducirError(error) {
  const m = (error.message || "").toLowerCase();
  if (m.includes("already registered")) return "Este correo ya está registrado. Inicia sesión.";
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("password")) return "La contraseña debe tener mínimo 6 caracteres.";
  if (m.includes("email")) return "Revisa que el correo esté bien escrito.";
  if (m.includes("fetch")) return "Sin conexión. Revisa tu internet e intenta de nuevo.";
  return "Ocurrió un error: " + error.message;
}

// ===== Cambiar entre pestañas =====
function verIngresar() {
  tabIngresar.classList.add("activa");
  tabRegistro.classList.remove("activa");
  formIngresar.classList.remove("oculto");
  formRegistro.classList.add("oculto");
  mostrar("");
}

function verRegistro() {
  tabRegistro.classList.add("activa");
  tabIngresar.classList.remove("activa");
  formRegistro.classList.remove("oculto");
  formIngresar.classList.add("oculto");
  mostrar("");
}

tabIngresar.addEventListener("click", verIngresar);
tabRegistro.addEventListener("click", verRegistro);

// ===== Mostrar el premio desde Supabase =====
async function cargarNegocio() {
  const { data } = await db.from("negocio").select("*").single();
  if (data) {
    document.getElementById("premioTexto").textContent = data.premio;
    document.getElementById("metaTexto").textContent = data.sellos_meta;
  }
}

// ===== Enviar a cada persona a su página =====
async function redirigir(user) {
  // ¿Es personal del local?
  const { data: staff } = await db
    .from("personal")
    .select("rol")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staff) {
    window.location.href = "admin.html";
    return;
  }

  // ¿Ya existe su tarjeta? Si no, se crea
  const { data: cliente } = await db
    .from("clientes")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!cliente) {
    const datos = user.user_metadata || {};
    const { error } = await db.from("clientes").insert({
      id: user.id,
      nombre: datos.nombre || "Cliente",
      celular: datos.celular || null
    });
    if (error) {
      mostrar(traducirError(error));
      return;
    }
  }

  window.location.href = "tarjeta.html";
}

// ===== Iniciar sesión =====
formIngresar.addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = formIngresar.querySelector("button");
  const email = document.getElementById("ingEmail").value.trim();
  const password = document.getElementById("ingPassword").value;

  if (!email || !password) {
    mostrar("Escribe tu correo y tu contraseña.");
    return;
  }

  boton.disabled = true;
  mostrar("Ingresando...", "ok");

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  boton.disabled = false;

  if (error) {
    mostrar(traducirError(error));
    return;
  }
  await redirigir(data.user);
});

// ===== Registrarse =====
formRegistro.addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = formRegistro.querySelector("button");
  const nombre = document.getElementById("regNombre").value.trim();
  const celular = document.getElementById("regCelular").value.replace(/\D/g, "");
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirmar = document.getElementById("regConfirmar").value;

  if (nombre.length < 2) return mostrar("Escribe tu nombre.");
  if (!/^3\d{9}$/.test(celular)) return mostrar("El celular debe tener 10 dígitos y empezar por 3.");
  if (!email) return mostrar("Escribe tu correo.");
  if (password.length < 6) return mostrar("La contraseña debe tener mínimo 6 caracteres.");
  if (password !== confirmar) return mostrar("Las contraseñas no coinciden.");

  boton.disabled = true;
  mostrar("Creando tu tarjeta...", "ok");

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { nombre, celular } }
  });
  boton.disabled = false;

  if (error) {
    mostrar(traducirError(error));
    return;
  }

  if (!data.session) {
    verIngresar();
    mostrar("Cuenta creada. Ahora inicia sesión.", "ok");
    return;
  }
  await redirigir(data.user);
});

// ===== Al abrir la página =====
async function iniciar() {
  cargarNegocio();

  // index.html?salir=1 cierra la sesión (útil para pruebas)
  if (new URLSearchParams(location.search).has("salir")) {
    await db.auth.signOut();
    mostrar("Sesión cerrada.", "ok");
    return;
  }

  // Si ya tiene sesión guardada, entra directo
  const { data } = await db.auth.getSession();
  if (data.session) {
    mostrar("Entrando a tu tarjeta...", "ok");
    await redirigir(data.session.user);
  }
}

iniciar();
