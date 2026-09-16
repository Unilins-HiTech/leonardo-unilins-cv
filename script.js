const STORAGE_KEY = "ac-es8-patients";

const form = document.querySelector("#patient-form");
const patientList = document.querySelector("#patient-list");
const patientCount = document.querySelector("#patient-count");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search");
const sortNameButton = document.querySelector("#sort-name");

let patients = loadPatients();
let sortDirection = "asc";

function loadPatients() {
  try {
    const savedPatients = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(savedPatients) ? savedPatients : [];
  } catch {
    return [];
  }
}

function savePatients() {
  // Salvamos apenas os pacientes manuais no localStorage para não misturar com o JSON
  const pacientesManuais = patients.filter(p => p.origin === 'manual');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pacientesManuais));
}

function calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  const birthdayHasNotPassed = today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (birthdayHasNotPassed) age -= 1;
  return age;
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function renderPatients() {
  const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const visiblePatients = patients
    .filter((patient) => patient.name.toLocaleLowerCase("pt-BR").includes(query))
    .sort((first, second) => {
      const comparison = first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    });

  patientList.replaceChildren();
  
  visiblePatients.forEach((patient) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(patient.name)}</td>
      <td>${escapeHtml(patient.email)}</td>
      <td>${escapeHtml(patient.phone)}</td>
      <td>${formatDate(patient.birthDate)}</td>
      <td>${calculateAge(patient.birthDate)} anos</td>
      <td><button class="remove-button" type="button" data-id="${patient.id}">Remover</button></td>
    `;
    patientList.append(row);
  });

  // ISSUE 1: Contador por Origem
  const qtdJson = patients.filter(p => p.origin === 'json').length;
  const qtdManual = patients.filter(p => p.origin === 'manual').length;
  patientCount.textContent = `Total de pacientes: ${patients.length} (Oriundos do JSON: ${qtdJson} | Cadastrados na Sessão: ${qtdManual})`;

  // ISSUE 1: Tratamento de Lista Vazia
  if (patients.length === 0) {
    emptyState.textContent = "Nenhum paciente cadastrado ainda.";
    emptyState.style.color = "inherit"; // Reseta cor caso estivesse vermelha do erro
    emptyState.hidden = false;
  } else {
    emptyState.hidden = visiblePatients.length > 0;
  }
  
  sortNameButton.querySelector("span").textContent = sortDirection === "asc" ? "↑" : "↓";
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

// ISSUE 1: Requisição Assíncrona, Latência e Tratamento de Erros
async function fetchPatientsData() {
  // Configurando a mensagem de carregamento inicial
  emptyState.textContent = "Carregando pacientes...";
  emptyState.hidden = false;

  // ISSUE 1: Simulação de Latência (1 segundo) antes do fetch
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // ISSUE 1: Forçando um erro proposital. 
    // Mude para "pacientes.json" para ver o sucesso, ou deixe assim para ver o erro na interface!
    const URL = "arquivo_inexistente.json"; 
    
    const resposta = await fetch(URL);

    if (!resposta.ok) {
      throw new Error("Erro na requisição. Status: " + resposta.status);
    }

    const dados = await resposta.json();

    // Mapeando dados do JSON e marcando a origem
    const pacientesDoJson = dados.map(p => ({
      ...p,
      origin: 'json',
      id: p.id || crypto.randomUUID() 
    }));

    // Mescla os pacientes do localStorage (manuais) com os do JSON, evitando duplicidade pelo email
    const emailsManuais = new Set(patients.map(p => p.email));
    const novosPacientes = pacientesDoJson.filter(p => !emailsManuais.has(p.email));
    
    patients = [...patients, ...novosPacientes];
    
    renderPatients();

  } catch (erro) {
    // ISSUE 1: Tratamento de Erro Amigável
    console.error(erro); // Ainda logamos para o desenvolvedor ver
    patientList.replaceChildren(); // Limpa a tabela
    emptyState.textContent = "❌ Oops! Não foi possível carregar os dados do servidor. Por favor, recarregue a página e tente novamente.";
    emptyState.style.color = "red";
    emptyState.hidden = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const email = data.get("email").trim().toLocaleLowerCase("pt-BR");

  if (patients.some((patient) => patient.email === email)) {
    alert("Este e-mail já está cadastrado.");
    return;
  }

  patients.push({
    id: crypto.randomUUID(),
    name: data.get("name").trim(),
    email,
    phone: data.get("phone").trim(),
    birthDate: data.get("birthDate"),
    origin: 'manual' // ISSUE 1: Marcando a origem como manual
  });
  
  savePatients();
  form.reset();
  renderPatients();
});

patientList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-id]");
  if (!removeButton) return;
  patients = patients.filter((patient) => patient.id !== removeButton.dataset.id);
  savePatients();
  renderPatients();
});

searchInput.addEventListener("input", renderPatients);
sortNameButton.addEventListener("click", () => {
  sortDirection = sortDirection === "asc" ? "desc" : "asc";
  renderPatients();
});

// Iniciando a aplicação
renderPatients(); // Renderiza os dados locais primeiro
fetchPatientsData(); // Busca os dados remotos