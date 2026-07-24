/**
 * Makes file paths in pull request headers clickable, linking to the corresponding diff view.
 * @param {HTMLElement} header - The header element containing the file path text.
 */
export function makeFilePathsClickable(header) {
  header.setAttribute("data-pr-link-injected", "true");

  const filePath = header.textContent.trim();
  if (!filePath) return;

  const prUrlMatch = window.location.href.match(/^(https:\/\/bitbucket\.org\/[^\/]+\/[^\/]+\/pull-requests\/\d+)/);
  if (!prUrlMatch) return;

  const prBaseUrl = prUrlMatch[1];

  const diffUrl = `${prBaseUrl}/diff#chg-${filePath}`;

  const link = document.createElement("a");
  link.href = diffUrl;

  link.style.textDecoration = "none";
  link.style.color = "#669DF1"
  link.style.cursor = "pointer";

  link.addEventListener("mouseenter", () => {
    link.style.textDecoration = "underline";
  });
  link.addEventListener("mouseleave", () => {
    link.style.textDecoration = "none";
  });

  while (header.firstChild) {
    link.appendChild(header.firstChild);
  }

  header.appendChild(link);
}
