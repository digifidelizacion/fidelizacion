// ===== Configuración =====
const VIGENCIA_QR = 60; // segundos antes de renovar el QR
const CORAZON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.6.7-1.5 2.2-2.6 4.3-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';

let usuario = null;
let meta = 10;
let sellosActuales = null;
let qr = null;
let segundos = 0;
let generando = false;

const el = (id) => document.getElementById(id);

function mostrar(texto, tipo = "error") {
  el("mensaje").textContent = texto;
  el("mensaje").className = "mensaje " + tipo;
}

function avisar(texto) {
  const aviso = el("aviso");
  aviso.textContent = texto;
  aviso.classList.add("visible");
  if (navigator.vibrate) navigator.vibrate(200);
  setTimeout(() => aviso.classList.remove("visible"), 3500);
}

// ===== Dibujar la tarjeta =====
function render(cliente) {
  const sellos = Math.min(cliente.sellos, meta);
  const anterior = sellosActuales;
  sellosActuales = sellos;

  el("nombre").textContent = (cliente.nombre || "").split(" ")[0];
  el("sellosNum").textContent = sellos;
  el("metaNum").textContent = meta;

  const contenedor = el("sellos");
  contenedor.innerHTML = "";
  for (let i = 1; i <= meta; i++) {
    const sello = document.createElement("div");
    sello.className = "sello" + (i <= sellos ? " lleno" : "");
    if (anterior !== null && i > anterior && i <= sellos) {
      sello.classList.add("nuevo");
    }
    sello.innerHTML = CORAZON;
    contenedor.appendChild(sello);
  }
  contenedor.setAttribute("aria-label", sellos + " de " + meta + " sellos");

  const completa = sellos >= meta;
  const faltan = meta - sellos;
  el("premioListo").classList.toggle("oculto", !completa);
  el("premioInfo").classList.toggle("oculto", completa);
  el("faltan").textContent = completa
    ? "¡Completaste tu tarjeta!"
    : "Te falta" + (faltan === 1 ? "" : "n") + " " + faltan + " sello" + (faltan === 1 ? "" : "s") + " para tu premio";
  el("qrInstruccion").textContent = completa
    ? "Muestra este código al personal para redimir tu premio"
    : "Muestra este código al personal para recibir tu sello";

  if (anterior !== null) {
    if (sellos > anterior) {
      avisar(completa ? "¡Completaste tu tarjeta! 🎉" : "¡Sumaste un sello! ♥");
    } else if (sellos < anterior) {
      avisar("Premio redimido. ¡Empieza una nueva tarjeta!");
    }
  }
}

async function cargarCliente() {
  const { data, error } = await db
    .from("clientes")
    .select("*")
    .eq("id", usuario.id)
    .maybeSingle();

  if (error) {
    mostrar("No se pudo cargar tu tarjeta. Revisa tu conexión.");
    return;
  }
  if (!data) {
    window.location.href = "index.html";
    return;
  }
  render(data);
}

// ===== QR personal =====
async function nuevoToken() {
  if (generando) return;
  generando = true;
  const { data, error } = await db.rpc("generar_token");
  generando = false;

  if (error) {
    el("qrTiempo").textContent = "No se pudo generar el código. Reintentando...";
    segundos = 5;
    return;
  }
  qr.makeCode("TC:" + data);
  segundos = VIGENCIA_QR;
  el("qrTiempo").textContent = "El código se renueva en " + segundos + " s";
}

setInterval(() => {
  if (!qr || document.hidden || segundos <= 0) return;
  segundos--;
  if (segundos <= 0) {
    nuevoToken();
  } else {
    el("qrTiempo").textContent = "El código se renueva en " + segundos + " s";
  }
}, 1000);

// ===== Historial =====
async function cargarHistorial() {
  const { data } = await db
    .from("movimientos")
    .select("tipo, fecha")
    .eq("cliente_id", usuario.id)
    .order("fecha", { ascending: false })
    .limit(5);

  const lista = el("historial");
  lista.innerHTML = "";

  if (!data || data.length === 0) {
    const li = document.createElement("li");
    li.className = "vacio";
    li.textContent = "Aún no tienes visitas registradas";
    lista.appendChild(li);
    return;
  }

  data.forEach((m) => {
    const li = document.createElement("li");
    const tipo = document.createElement("span");
    const fecha = document.createElement("span");
    tipo.textContent = m.tipo === "sello" ? "♥ Sello" : "★ Premio redimido";
    fecha.textContent = new Date(m.fecha).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    li.append(tipo, fecha);
    lista.appendChild(li);
  });
}

// ===== Tiempo real =====
function escucharCambios() {
  db.channel("tarjeta-" + usuario.id)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "clientes",
        filter: "id=eq." + usuario.id
      },
      (payload) => {
        render(payload.new);
        nuevoToken();
        cargarHistorial();
      }
    )
    .subscribe();
}

// ===== Al volver a la app =====
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && usuario) {
    cargarCliente();
    nuevoToken();
    cargarHistorial();
  }
});

// ===== Cerrar sesión =====
el("btnSalir").addEventListener("click", async () => {
  await db.auth.signOut();
  window.location.href = "index.html";
});

// ===== Inicio =====
async function iniciar() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    window.location.href = "index.html";
    return;
  }
  usuario = data.session.user;

  // Si es personal, va al panel
  const { data: staff } = await db
    .from("personal")
    .select("rol")
    .eq("user_id", usuario.id)
    .maybeSingle();
  if (staff) {
    window.location.href = "admin.html";
    return;
  }

  const { data: negocio } = await db.from("negocio").select("*").single();
  if (negocio) {
    meta = negocio.sellos_meta;
    el("premioTexto").textContent = negocio.premio;
    el("premioTexto2").textContent = negocio.premio;
  }

  qr = new QRCode(el("qr"), {
    text: "TC",
    width: 190,
    height: 190,
    colorDark: "#1f0a0f",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  await cargarCliente();
  await nuevoToken();
  cargarHistorial();
  escucharCambios();
}

iniciar();
