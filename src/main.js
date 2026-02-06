import "./style.css";
import "./nav.js";

const year = document.querySelector("[data-year]");
if (year) {
  year.textContent = new Date().getFullYear();
}

const page = document.body?.dataset?.page;
if (page === "digital") {
  import("./digital.js")
    .then((module) => module.initDigital?.())
    .catch((error) => console.error("Falha ao carregar Digital", error));
} else if (
  document.getElementById("habitList") &&
  document.getElementById("days")
) {
  import("./tracker.js");
}
