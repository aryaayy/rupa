import { formArt } from "./forms.js";

const forms = [
  { kind: "arena", name: "Arena", label: "Fire Sword as an Arena relic", title: "A relic you earn.", detail: "The original Fire Sword, ready for its next form." },
  { kind: "social", name: "Social", label: "Fire Sword as a Social badge", title: "A badge with your history.", detail: "The same relic, expressed as your profile badge." },
  { kind: "gallery", name: "Gallery", label: "Fire Sword as a Gallery artwork", title: "An artwork with an origin.", detail: "A collectible form, connected to the same asset." },
] as const;

// Keep the selection across the app's config/balance rerenders.
let selected = 0;
let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
let advances = 0;

export function formPreview() {
  return `<div class="hero-visual" data-form-preview>
    <div class="hero-object">
      <div class="preview-topline"><span>One relic. Three possibilities.</span><span class="preview-lights" aria-hidden="true"><i></i><i></i><i></i></span></div>
      <div class="form-stage"><span class="stage-spark" aria-hidden="true">+</span><span class="stage-floor" aria-hidden="true"></span><div class="form-illustration" role="img"></div><span class="stage-corner">SAME ASSET · SAME OWNER</span></div>
      <div class="preview-description"><strong></strong><p></p></div>
    </div>
    <div class="form-switcher" role="group" aria-label="Preview asset forms">${forms.map((form, index) => `<button type="button" data-form="${index}" aria-label="Preview ${form.name} form" aria-pressed="false">${form.name}</button>`).join("")}</div>
    <div class="preview-bottomline"><span>Illustrative forms · ownership stays yours</span><button type="button" class="preview-play" data-play></button></div>
  </div>`;
}

export function mountFormPreview(root: HTMLElement): () => void {
  const preview = root.querySelector<HTMLElement>("[data-form-preview]");
  if (!preview) return () => {};
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const stage = preview.querySelector<HTMLElement>(".form-stage")!;
  const illustration = preview.querySelector<HTMLElement>(".form-illustration")!;
  const play = preview.querySelector<HTMLButtonElement>("[data-play]")!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function schedule() {
    clearTimeout(timer);
    if (disposed || !playing || media.matches || document.hidden) return;
    timer = setTimeout(() => {
      // One full sequence, then stop. Replay is always an explicit choice.
      if (++advances >= 3) playing = false;
      else selected = (selected + 1) % forms.length;
      update(true);
    }, 3000);
  }
  function update(animate = false) {
    const form = forms[selected]!;
    stage.dataset.kind = form.kind;
    illustration.className = "form-illustration";
    illustration.innerHTML = formArt(form.kind);
    illustration.setAttribute("aria-label", form.label);
    if (animate && !media.matches) {
      void illustration.offsetWidth;
      illustration.classList.add("is-changing");
    }
    preview!.querySelector(".preview-description strong")!.textContent = form.title;
    preview!.querySelector(".preview-description p")!.textContent = form.detail;
    for (const button of preview!.querySelectorAll<HTMLButtonElement>("[data-form]")) button.setAttribute("aria-pressed", String(Number(button.dataset.form) === selected));
    play.hidden = media.matches;
    play.textContent = playing ? "Ⅱ Pause animation" : "▷ Play animation";
    play.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
    schedule();
  }
  function click(event: Event) {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!target) return;
    if (target.dataset.form !== undefined) {
      selected = Number(target.dataset.form); playing = false; advances = 0;
    } else if (target.hasAttribute("data-play")) {
      playing = !playing; advances = 0;
      if (playing) selected = 0;
    } else return;
    update(true);
  }
  function preferenceChanged() { playing = false; update(); }
  function visibilityChanged() { schedule(); }
  if (media.matches) playing = false;
  preview.addEventListener("click", click);
  media.addEventListener("change", preferenceChanged);
  document.addEventListener("visibilitychange", visibilityChanged);
  update();
  return () => {
    disposed = true; clearTimeout(timer);
    preview.removeEventListener("click", click);
    media.removeEventListener("change", preferenceChanged);
    document.removeEventListener("visibilitychange", visibilityChanged);
  };
}
