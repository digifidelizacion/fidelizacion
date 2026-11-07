// ===== Estado =====
let usuario = null;
let rol = null;
let meta = 10;
let lector = null;
let escaneando = false;
let procesando = false;
let tokenActual = null;
let clienteActual = null;
let clientes = [];

const el = (id) => document.getElementById(id);

function mostrar(id, texto, tipo = "error") {
  el(id).textContent = texto;
  el(id).className = "mensaje " + tipo;
}

// ===== Escáner de QR =====
async function iniciarLector() {
  if (escaneando) return;
  if (!lector) lector = new Html5Qrcode("lector");

  try {
    await lector.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      leerQR,
      () => {}
    );
    escaneando = true;
    procesando = false;
    el("btnEscanear").textContent = "Detener cámara";
    mostrar("msgEscaner", "Apunta la cámara al QR de la clienta", "ok");
  } catch (e) {
    mostrar("msgEscaner", "No se pudo abrir la cámara. Revisa los permisos del navegador.");
  }
}

async function detenerLector() {
  if (!escaneando) return;
  try {
    await lector.stop();
  } catch (e) {}
  escaneando = false;
  el("btnEscanear").textContent = "Escanear QR";
}

async function leerQR(texto) {
  if (procesando) return;
  procesando = true;
  await detenerLector();

  if (!texto.startsWith("TC:")) {
    mostrar("msgEscaner", "Este QR no es una tarjeta Tres Corazones.");
    return;
  }

  tokenActual = texto.slice(3);
  mostrar("msgEscaner", "Consultando tarjeta...", "ok");

  const { data, error } = await db.rpc("consultar_token", { p_token: tokenActual });
  if (error) {
    tokenActual = null;
    mostrar("msgEscaner", error.message);
    return;
  }

  mostrar("msgEscaner", "");
  mostrarFicha(data);
}

el("btnEscanear").addEventListener("click", () => {
  escaneando ? detenerLector() : iniciarLector();
});

// ===== Ficha de la clienta =====
function mostrarFicha(c) {
  clienteActual = c;
  const total = c.meta || meta;
  const completa = c.sellos >= total;

  el("fichaNombre").textContent = c.nombre;
  el("fichaDato").textContent =
    (c.celular ? "Cel. " + c.celular + " · " : "") +
    "Premios redimidos: " + (c.premios || 0);
  el("fichaConteo").textContent = c.sellos + " / " + total + " sellos";

  const mini = el("fichaSellos");
  mini.innerHTML = "";
  for (let i = 1; i <= total; i++) {
    const s = document.createElement("span");
    if (i <= c.sellos) s.className = "lleno";
    mini.appendChild(s);
  }

  el("btnSello").classList.toggle("oculto", completa || !tokenActual);
  el("btnCanjear").classList.toggle("oculto", !completa);
  el("cajaFicha").classList.remove("oculto");
  mostrar("msgFicha", completa ? "¡Tarjeta completa! Puedes redimir el premio." : "", "ok");
}

el("btnSello").addEventListener("click", async () => {
  if (!tokenActual) return;
  el("btnSello").disabled = true;

  const { data, error } = await db.rpc("sumar_sello", { p_token: tokenActual });
  el("btnSello").disabled = false;
  tokenActual = null;

  if (error) {
    mostrar("msgFicha", error.message);
    el("btnSello").classList.add("oculto");
    return;
  }

  mostrarFicha({ ...clienteActual, sellos: data.sellos, meta: data.meta });
  mostrar("msgFicha", "Sello agregado ✅", "ok");
  cargarClientes();
});

el("btnCanjear").addEventListener("click", () => {
  if (clienteActual) canjear(clienteActual.cliente_id, clienteActual.nombre);
});

el("btnCerrarFicha").addEventListener("click", () => {
  el("cajaFicha").classList.add("oculto");
  clienteActual = null;
  tokenActual = null;
});

async function canjear(id, nombre) {
  if (!confirm("¿Redimir el premio de " + nombre + "? La tarjeta vuelve a 0.")) return;

  const { error } = await db.rpc("canjear_premio", { p_cliente: id });
  if (error) {
    alert(error.message);
    return;
  }

  if (clienteActual && clienteActual.cliente_id === id) {
    mostrarFicha({
      ...clienteActual,
      sellos: 0,
      premios: (clienteActual.premios || 0) + 1
    });
    mostrar("msgFicha", "Premio redimido 🎉", "ok");
  }
  cargarClientes();
}

// ===== Lista de clientas =====
async function cargarClientes() {
  const { data, error } = await db
    .from("clientes")
    .select("id, nombre, celular, sellos, premios_canjeados")
    .order("nombre");

  if (error) {
    mostrar("msgLista", "No se pudo cargar la lista.");
    return;
  }

  clientes = data || [];
  el("totClientas").textContent = clientes.length;
  el("totCompletas").textContent = clientes.filter((c) => c.sellos >= meta).length;
  el("totPremios").textContent = clientes.reduce((s, c) => s + c.premios_canjeados, 0);
  pintarLista();
}

function pintarLista() {
  const filtro = el("buscar").value.trim().toLowerCase();
  const lista = el("lista");
  lista.innerHTML = "";

  const visibles = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(filtro) ||
      (c.celular || "").includes(filtro)
  );

  if (visibles.length === 0) {
    const li = document.createElement("li");
    li.className = "vacio";
    li.textContent = "No hay clientas para mostrar";
    lista.appendChild(li);
    return;
  }

  visibles.forEach((c) => {
    const li = document.createElement("li");

    const info = document.createElement("div");
    info.className = "info";
    const nombre = document.createElement("span");
    nombre.textContent = c.nombre;
    const cel = document.createElement("small");
    cel.textContent = c.celular || "Sin celular";
    info.append(nombre, cel);

    const derecha = document.createElement("div");
    if (c.sellos >= meta) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--chico";
      btn.textContent = "Redimir";
      btn.addEventListener("click", () => canjear(c.id, c.nombre));
      derecha.appendChild(btn);
    } else {
      const conteo = document.createElement("span");
      conteo.className = "conteo";
      conteo.textContent = "♥ " + c.sellos + " / " + meta;
      derecha.appendChild(conteo);
    }

    li.append(info, derecha);
    lista.appendChild(li);
  });
}

el("buscar").addEventListener("input", pintarLista);

// ===== Configuración (solo admin) =====
el("formConfig").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = el("cfgNombre").value.trim();
  const premio = el("cfgPremio").value.trim();
  const sellos = parseInt(el("cfgMeta").value, 10);

  if (!nombre || !premio) return mostrar("msgConfig", "Completa todos los campos.");
  if (isNaN(sellos) || sellos < 1 || sellos > 20) {
    return mostrar("msgConfig", "Los sellos deben estar entre 1 y 20.");
  }

  const { error } = await db
    .from("negocio")
    .update({ nombre, premio, sellos_meta: sellos })
    .eq("id", 1);

  if (error) return mostrar("msgConfig", error.message);
  meta = sellos;
  mostrar("msgConfig", "Configuración guardada ✅", "ok");
  cargarClientes();
});

// ===== Cerrar sesión =====
el("btnSalir").addEventListener("click", async () => {
  await detenerLector();
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

  const { data: staff } = await db
    .from("personal")
    .select("nombre, rol")
    .eq("user_id", usuario.id)
    .maybeSingle();

  if (!staff) {
    window.location.href = "tarjeta.html";
    return;
  }
  rol = staff.rol;
  el("nombreStaff").textContent = staff.nombre;

  const { data: negocio } = await db.from("negocio").select("*").single();
  if (negocio) {
    meta = negocio.sellos_meta;
    el("cfgNombre").value = negocio.nombre;
    el("cfgPremio").value = negocio.premio;
    el("cfgMeta").value = negocio.sellos_meta;
  }

  if (rol === "admin") el("cajaConfig").classList.remove("oculto");

  document.body.classList.remove("cargando");
  cargarClientes();
}

iniciar();
