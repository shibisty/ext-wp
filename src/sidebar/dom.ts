// Minimal DOM builder — the panel is small enough not to need a framework,
// but hand-written createElement/appendChild chains were most of the old
// sidebar.js. Always uses textContent for strings (never innerHTML), so
// values coming from WordPress can't inject markup.

type Child = Node | string | null | undefined | false;
type Props<K extends keyof HTMLElementTagNameMap> = Partial<Omit<HTMLElementTagNameMap[K], 'dataset' | 'style'>> & {
  dataset?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props<K> | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    const { dataset, style, ...rest } = props;
    Object.assign(el, rest);
    if (dataset) Object.assign(el.dataset, dataset);
    if (style) Object.assign(el.style, style);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

/** type="button" by default — every button in the panel lives inside a <form> somewhere. */
export function button(props: Props<'button'>, ...children: Child[]): HTMLButtonElement {
  return h('button', { type: 'button', ...props }, ...children);
}

export function labeled(labelText: string, control: Node, hint?: string): HTMLLabelElement {
  return h('label', null, labelText, control, hint ? h('span', { className: 'seb-field-hint', textContent: hint }) : null);
}
