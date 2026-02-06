const navLinks = document.querySelectorAll(".nav-link");
const isLegacy = window.location.pathname.includes("legacy");

if (!isLegacy) {
  document.body.classList.add("page-transition");
  requestAnimationFrame(() => {
    document.body.classList.add("is-ready");
  });
}

if (navLinks.length) {
  const normalizePath = (value) => {
    if (!value) return "/";
    let path = value.replace(/\/index\.html$/, "/");
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    return path;
  };

  const current = normalizePath(window.location.pathname);

  navLinks.forEach((link) => {
    const href = link.getAttribute("href") || "/";
    let linkPath = "/";
    try {
      linkPath = normalizePath(new URL(href, window.location.origin).pathname);
    } catch {
      linkPath = normalizePath(href);
    }

    if (linkPath === current) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }

    link.addEventListener("click", (event) => {
      if (isLegacy) return;
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.getAttribute("target") === "_blank") return;
      if (linkPath === current) return;

      event.preventDefault();
      document.body.classList.add("is-exiting");
      setTimeout(() => {
        window.location.href = href;
      }, 300);
    });
  });
}
