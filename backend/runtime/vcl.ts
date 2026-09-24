/*!
 * JS-Delphi VCL runtime — vcl.ts
 *
 * Fixed runtime shared by the IDE form designer (design-time) and by every generated
 * application (runtime). The IDE never generates this file: the BuildService copies it
 * verbatim into each build, which is what makes the designer WYSIWYG — the very same
 * classes, property setters and layout code run in both places.
 *
 * Hierarchy (Delphi VCL):
 *   TObject → TPersistent → TComponent → TControl → TGraphicControl
 *                                                 → TWinControl → TCustomForm → TForm
 *
 * Only "erasable" TypeScript syntax is used (no enums/namespaces/parameter properties).
 */

export const VCL_VERSION = '1.0.0';

const HAS_DOM = typeof document !== 'undefined' && typeof window !== 'undefined';

/* ================================================================== types == */

export type TAlign = 'alNone' | 'alTop' | 'alBottom' | 'alLeft' | 'alRight' | 'alClient';
export type TAnchorKind = 'akLeft' | 'akTop' | 'akRight' | 'akBottom';
export type TAnchors = TAnchorKind[];
export type TFontStyle = 'fsBold' | 'fsItalic' | 'fsUnderline' | 'fsStrikeOut';
export type TColor = string;
export type TCursor =
  | 'crDefault' | 'crArrow' | 'crHandPoint' | 'crIBeam' | 'crCross' | 'crHourGlass'
  | 'crNo' | 'crSizeAll' | 'crSizeWE' | 'crSizeNS' | 'crHelp' | 'crDrag';
export type TAlignment = 'taLeftJustify' | 'taRightJustify' | 'taCenter';
export type TTextLayout = 'tlTop' | 'tlCenter' | 'tlBottom';
export type TBevelCut = 'bvNone' | 'bvLowered' | 'bvRaised' | 'bvSpace';
export type TBorderStyle = 'bsNone' | 'bsSingle';
export type TFormBorderStyle = 'bsNone' | 'bsSingle' | 'bsSizeable' | 'bsDialog' | 'bsToolWindow' | 'bsSizeToolWin';
export type TBorderIcon = 'biSystemMenu' | 'biMinimize' | 'biMaximize' | 'biHelp';
export type TPosition = 'poDesigned' | 'poDefault' | 'poScreenCenter' | 'poMainFormCenter' | 'poOwnerFormCenter';
export type TWindowState = 'wsNormal' | 'wsMinimized' | 'wsMaximized';
export type TCloseAction = 'caNone' | 'caHide' | 'caFree' | 'caMinimize';
export type TScrollStyle = 'ssNone' | 'ssHorizontal' | 'ssVertical' | 'ssBoth';
export type TEditCharCase = 'ecNormal' | 'ecUpperCase' | 'ecLowerCase';
export type TComboBoxStyle = 'csDropDown' | 'csDropDownList';
export type TCheckBoxState = 'cbUnchecked' | 'cbChecked' | 'cbGrayed';
export type TLeftRight = 'taLeftJustify' | 'taRightJustify';
export type TProgressBarOrientation = 'pbHorizontal' | 'pbVertical';
export type TProgressBarState = 'pbsNormal' | 'pbsError' | 'pbsPaused';
export type TTabPosition = 'tpTop' | 'tpBottom';
export type TShiftStateItem = 'ssShift' | 'ssAlt' | 'ssCtrl' | 'ssMeta' | 'ssLeft' | 'ssRight' | 'ssMiddle' | 'ssDouble';
export type TShiftState = TShiftStateItem[];
export type TMouseButton = 'mbLeft' | 'mbRight' | 'mbMiddle';
export type TDataSetState = 'dsInactive' | 'dsBrowse' | 'dsEdit' | 'dsInsert';
export type TFieldType =
  | 'ftUnknown' | 'ftString' | 'ftInteger' | 'ftFloat' | 'ftCurrency' | 'ftBoolean'
  | 'ftDate' | 'ftDateTime' | 'ftTime' | 'ftMemo' | 'ftBlob';
export type TParamType = 'ptInput' | 'ptOutput' | 'ptInputOutput';
export type TGridOption =
  | 'dgTitles' | 'dgIndicator' | 'dgColLines' | 'dgRowLines' | 'dgRowSelect'
  | 'dgAlwaysShowSelection' | 'dgEditing' | 'dgStriped';
export type TNavigateBtn =
  | 'nbFirst' | 'nbPrior' | 'nbNext' | 'nbLast' | 'nbInsert' | 'nbDelete'
  | 'nbEdit' | 'nbPost' | 'nbCancel' | 'nbRefresh';
export type TMsgDlgType = 'mtWarning' | 'mtError' | 'mtInformation' | 'mtConfirmation' | 'mtCustom';
export type TMsgDlgBtn = 'mbYes' | 'mbNo' | 'mbOK' | 'mbCancel' | 'mbAbort' | 'mbRetry' | 'mbIgnore' | 'mbAll' | 'mbClose';
export type TComponentStateFlag = 'csLoading' | 'csReading' | 'csDestroying' | 'csDesigning' | 'csUpdating';
export type TOperation = 'opInsert' | 'opRemove';

export interface TRect { Left: number; Top: number; Right: number; Bottom: number; }
export interface TPoint { X: number; Y: number; }

export function Rect(Left: number, Top: number, Right: number, Bottom: number): TRect {
  return { Left, Top, Right, Bottom };
}
export function Point(X: number, Y: number): TPoint {
  return { X, Y };
}

/** Modal results (Delphi mrXxx constants). */
export type TModalResult = number;
export const mrNone = 0;
export const mrOk = 1;
export const mrCancel = 2;
export const mrAbort = 3;
export const mrRetry = 4;
export const mrIgnore = 5;
export const mrYes = 6;
export const mrNo = 7;
export const mrClose = 8;
export const mrAll = 12;
export const ModalResultNames: Record<string, number> = {
  mrNone, mrOk, mrCancel, mrAbort, mrRetry, mrIgnore, mrYes, mrNo, mrClose, mrAll,
};

/* ================================================================ errors == */

export class EVclError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EVclError';
  }
}
export class EComponentError extends EVclError {
  constructor(message: string) {
    super(message);
    this.name = 'EComponentError';
  }
}
export class EListError extends EVclError {
  constructor(message: string) {
    super(message);
    this.name = 'EListError';
  }
}
export class EDatabaseError extends EVclError {
  constructor(message: string) {
    super(message);
    this.name = 'EDatabaseError';
  }
}
export class EConvertError extends EVclError {
  constructor(message: string) {
    super(message);
    this.name = 'EConvertError';
  }
}

/* ============================================================== utilities == */

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export function IsValidIdent(name: string): boolean {
  return IDENT_RE.test(name);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: Node | null): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Builds a tiny inline SVG icon from path data (no innerHTML — CSP/XSS safe). */
function svgIcon(paths: string[], size = 16, cls = 'vcl-svg'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function toInt(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function sameArray<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function PtToPx(pt: number): number {
  return Math.round(((pt * 96) / 72) * 100) / 100;
}

/** Renders a caption honouring Delphi '&' accelerators ("&Kaydet" → underlined K). */
function renderAccelCaption(target: HTMLElement, caption: string, showAccel = true): string {
  target.textContent = '';
  let accel = '';
  if (!showAccel || caption.indexOf('&') < 0) {
    target.textContent = caption;
    return accel;
  }
  let buf = '';
  for (let i = 0; i < caption.length; i++) {
    const ch = caption[i];
    if (ch === '&' && i + 1 < caption.length) {
      const next = caption[i + 1];
      if (next === '&') {
        buf += '&';
        i++;
        continue;
      }
      if (buf) target.appendChild(document.createTextNode(buf));
      buf = '';
      const u = document.createElement('u');
      u.textContent = next;
      target.appendChild(u);
      if (!accel) accel = next.toLowerCase();
      i++;
      continue;
    }
    buf += ch;
  }
  if (buf) target.appendChild(document.createTextNode(buf));
  return accel;
}

/** Strips '&' accelerators: "&Kaydet" → "Kaydet". */
export function StripAccel(caption: string): string {
  return caption.replace(/&(.)/g, '$1');
}

/** Only allow image sources that cannot execute script. */
export function IsSafeImageSource(src: string): boolean {
  const s = src.trim();
  if (!s) return true;
  if (/^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml|x-icon);/i.test(s)) return true;
  if (/^(https?:|blob:)/i.test(s)) return true;
  // relative paths such as "assets/logo.png" (no scheme at all)
  return !/^[a-z][a-z0-9+.-]*:/i.test(s) && !s.startsWith('//');
}

/* ================================================================= colors == */

const SYSTEM_COLORS: Record<string, [string, string]> = {
  // name: [css variable, default value used by editors/swatches]
  clScrollBar: ['--vcl-scrollbar', '#c8c8c8'],
  clBackground: ['--vcl-background', '#1f4e79'],
  clActiveCaption: ['--vcl-activecaption', '#ffffff'],
  clInactiveCaption: ['--vcl-inactivecaption', '#fafafa'],
  clMenu: ['--vcl-menu', '#f9f9f9'],
  clWindow: ['--vcl-window', '#ffffff'],
  clWindowFrame: ['--vcl-windowframe', '#646464'],
  clMenuText: ['--vcl-menutext', '#1a1a1a'],
  clWindowText: ['--vcl-windowtext', '#1a1a1a'],
  clCaptionText: ['--vcl-captiontext', '#1a1a1a'],
  clActiveBorder: ['--vcl-activeborder', '#b4b4b4'],
  clInactiveBorder: ['--vcl-inactiveborder', '#d4d4d4'],
  clAppWorkSpace: ['--vcl-appworkspace', '#ababab'],
  clHighlight: ['--vcl-highlight', '#0078d7'],
  clHighlightText: ['--vcl-highlighttext', '#ffffff'],
  clBtnFace: ['--vcl-btnface', '#f0f0f0'],
  clBtnShadow: ['--vcl-btnshadow', '#a0a0a0'],
  clGrayText: ['--vcl-graytext', '#8a8a8a'],
  clBtnText: ['--vcl-btntext', '#1a1a1a'],
  clInactiveCaptionText: ['--vcl-inactivecaptiontext', '#6d6d6d'],
  clBtnHighlight: ['--vcl-btnhighlight', '#ffffff'],
  cl3DDkShadow: ['--vcl-3ddkshadow', '#696969'],
  cl3DLight: ['--vcl-3dlight', '#e3e3e3'],
  clInfoText: ['--vcl-infotext', '#1a1a1a'],
  clInfoBk: ['--vcl-infobk', '#ffffe1'],
  clHotLight: ['--vcl-hotlight', '#0066cc'],
  clGradientActiveCaption: ['--vcl-gradactive', '#b9d1ea'],
  clGradientInactiveCaption: ['--vcl-gradinactive', '#d7e4f2'],
  clMenuHighlight: ['--vcl-menuhighlight', '#cce4f7'],
  clMenuBar: ['--vcl-menubar', '#f3f3f3'],
};

const STANDARD_COLORS: Record<string, string> = {
  clBlack: '#000000', clMaroon: '#800000', clGreen: '#008000', clOlive: '#808000',
  clNavy: '#000080', clPurple: '#800080', clTeal: '#008080', clGray: '#808080',
  clSilver: '#c0c0c0', clRed: '#ff0000', clLime: '#00ff00', clYellow: '#ffff00',
  clBlue: '#0000ff', clFuchsia: '#ff00ff', clAqua: '#00ffff', clWhite: '#ffffff',
  clMoneyGreen: '#c0dcc0', clSkyBlue: '#a6caf0', clCream: '#fffbf0', clMedGray: '#a0a0a4',
  clWebOrange: '#ffa500', clWebCornflowerBlue: '#6495ed', clWebTomato: '#ff6347',
  clWebSeaGreen: '#2e8b57', clWebSteelBlue: '#4682b4', clWebGold: '#ffd700',
};

/** All named colours, standard first (used by the Object Inspector colour editor). */
export const ColorNames: readonly string[] = [
  ...Object.keys(STANDARD_COLORS),
  ...Object.keys(SYSTEM_COLORS),
  'clNone',
  'clDefault',
];

export function IsValidColor(c: string): boolean {
  return (
    c in STANDARD_COLORS || c in SYSTEM_COLORS || c === 'clNone' || c === 'clDefault' ||
    /^#[0-9a-fA-F]{6}$/.test(c) || /^\$[0-9a-fA-F]{8}$/.test(c)
  );
}

/** Converts a Delphi colour (clRed, clBtnFace, $00BBGGRR, #RRGGBB) to a CSS colour. */
export function ColorToCSS(c: TColor): string {
  if (!c || c === 'clDefault') return '';
  if (c === 'clNone') return 'transparent';
  const std = STANDARD_COLORS[c];
  if (std) return std;
  const sys = SYSTEM_COLORS[c];
  if (sys) return `var(${sys[0]}, ${sys[1]})`;
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  if (/^\$[0-9a-fA-F]{8}$/.test(c)) {
    const bb = c.slice(3, 5), gg = c.slice(5, 7), rr = c.slice(7, 9);
    return `#${rr}${gg}${bb}`.toLowerCase();
  }
  return '';
}

/** Resolves any colour to #rrggbb (system colours use their default theme value). */
export function ColorToRGB(c: TColor): string {
  if (c === 'clNone' || c === 'clDefault' || !c) return '#000000';
  const sys = SYSTEM_COLORS[c];
  if (sys) return sys[1];
  const css = ColorToCSS(c);
  return /^#[0-9a-f]{6}$/.test(css) ? css : '#000000';
}

const CURSORS: Record<TCursor, string> = {
  crDefault: '', crArrow: 'default', crHandPoint: 'pointer', crIBeam: 'text', crCross: 'crosshair',
  crHourGlass: 'wait', crNo: 'not-allowed', crSizeAll: 'move', crSizeWE: 'ew-resize',
  crSizeNS: 'ns-resize', crHelp: 'help', crDrag: 'grab',
};

export const FontNames: readonly string[] = [
  'Segoe UI', 'Arial', 'Tahoma', 'Verdana', 'Calibri', 'Cambria', 'Consolas', 'Courier New',
  'Georgia', 'Times New Roman', 'Trebuchet MS', 'Inter', 'Roboto', 'system-ui',
];

function fontStack(name: string): string {
  const quoted = `"${name.replace(/["\\]/g, '')}"`;
  switch (name) {
    case 'Segoe UI':
      return `"Segoe UI", "Segoe UI Variable Text", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif`;
    case 'Consolas':
    case 'Courier New':
      return `${quoted}, ui-monospace, "Cascadia Mono", Menlo, monospace`;
    case 'Times New Roman':
    case 'Georgia':
    case 'Cambria':
      return `${quoted}, "Times New Roman", serif`;
    case 'system-ui':
      return 'system-ui, sans-serif';
    default:
      return `${quoted}, "Segoe UI", system-ui, Arial, sans-serif`;
  }
}

/* =================================================================== RTTI == */

export type TPropKind =
  | 'int' | 'float' | 'string' | 'text' | 'bool' | 'enum' | 'set' | 'color' | 'font'
  | 'strings' | 'component' | 'connection' | 'table' | 'columns' | 'sql' | 'params'
  | 'image' | 'cursor' | 'datafield' | 'procname' | 'fieldlist' | 'modalresult' | 'fontname';

export type TPropCategory = 'Layout' | 'Visual' | 'Behavior' | 'Input' | 'Data' | 'Database' | 'Help' | 'Misc';

export interface TPropInfo {
  name: string;
  kind: TPropKind;
  category: TPropCategory;
  default?: unknown;
  values?: readonly string[];
  refClass?: string;
  min?: number;
  max?: number;
  hint?: string;
  readOnly?: boolean;
  /** false → never written to the design file (runtime-only / computed). */
  stored?: boolean;
  /** Object Inspector applies the value while typing (Caption, Text). */
  live?: boolean;
  /** Not shown in the Object Inspector (e.g. DesignLeft/DesignTop). */
  hidden?: boolean;
  /** Only meaningful to the designer; the BuildService never emits it. */
  designOnly?: boolean;
}

export interface TEventInfo {
  name: string;
  /** TypeScript parameter list used for stubs/IntelliSense, e.g. "Sender: TButton, e: MouseEvent". */
  params: string;
  hint?: string;
}

export interface TComponentInfo {
  name: string;
  parent: string | null;
  palette?: string;
  icon?: string;
  hint?: string;
  visual: boolean;
  container: boolean;
  props: TPropInfo[];
  events: TEventInfo[];
  hide?: string[];
  defaultEvent?: string;
  defaultSize?: { w: number; h: number };
  abstract?: boolean;
}

export interface TMergedComponentInfo extends TComponentInfo {
  ancestors: string[];
}

export type TComponentClass<T extends TComponent = TComponent> = {
  new (AOwner?: TComponent | null): T;
  prototype: T;
};

interface TRegistryEntry {
  cls: TComponentClass;
  info: TComponentInfo;
}

const ClassRegistry = new Map<string, TRegistryEntry>();
const ClassNames = new WeakMap<object, string>();
const MergedCache = new Map<string, TMergedComponentInfo>();

/** Registers a component class together with its published RTTI. */
export function RegisterClass(cls: TComponentClass, info: TComponentInfo): void {
  ClassRegistry.set(info.name, { cls, info });
  ClassNames.set(cls, info.name);
  MergedCache.clear();
}

export function ClassNameOf(ctor: unknown): string {
  let c = ctor as { name?: string; prototype?: unknown } | null;
  while (c) {
    const n = ClassNames.get(c as object);
    if (n) return n;
    if (c === TObject) break;
    c = Object.getPrototypeOf(c);
  }
  return (ctor as { name?: string })?.name ?? 'TObject';
}

/** Name of the nearest *registered* ancestor class (TButton for a user subclass of TButton). */
export function RegisteredClassOf(obj: TObject): string {
  let c: unknown = obj.constructor;
  while (c && c !== Function.prototype) {
    const n = ClassNames.get(c as object);
    if (n && ClassRegistry.get(n)?.cls === c) return n;
    c = Object.getPrototypeOf(c);
  }
  return 'TObject';
}

export function FindClass(name: string): TComponentClass | null {
  return ClassRegistry.get(name)?.cls ?? null;
}

export function GetClass(name: string): TComponentClass {
  const cls = FindClass(name);
  if (!cls) throw new EComponentError(`Sınıf bulunamadı: ${name}`);
  return cls;
}

export function GetRegisteredClassNames(): string[] {
  return [...ClassRegistry.keys()];
}

/** RTTI with inherited properties/events merged (child overrides parent by name). */
export function GetClassInfo(name: string): TMergedComponentInfo | null {
  const cached = MergedCache.get(name);
  if (cached) return cached;
  const entry = ClassRegistry.get(name);
  if (!entry) return null;
  const own = entry.info;
  const base = own.parent ? GetClassInfo(own.parent) : null;
  const props: TPropInfo[] = base ? base.props.map((p) => ({ ...p })) : [];
  for (const p of own.props) {
    const i = props.findIndex((x) => x.name === p.name);
    if (i >= 0) props[i] = { ...props[i], ...p };
    else props.push({ ...p });
  }
  const events: TEventInfo[] = base ? base.events.map((e) => ({ ...e })) : [];
  for (const e of own.events) {
    const i = events.findIndex((x) => x.name === e.name);
    if (i >= 0) events[i] = { ...e };
    else events.push({ ...e });
  }
  const hide = new Set([...(base?.hide ?? []), ...(own.hide ?? [])]);
  const merged: TMergedComponentInfo = {
    ...own,
    icon: own.icon ?? own.name,
    defaultEvent: own.defaultEvent ?? base?.defaultEvent,
    defaultSize: own.defaultSize ?? base?.defaultSize,
    props: props.filter((p) => !hide.has(p.name)),
    events: events.filter((e) => !hide.has(e.name)),
    hide: [...hide],
    ancestors: base ? [...base.ancestors, base.name] : [],
  };
  MergedCache.set(name, merged);
  return merged;
}

export function InheritsFromClass(className: string, baseName: string): boolean {
  if (className === baseName) return true;
  return GetClassInfo(className)?.ancestors.includes(baseName) ?? false;
}

export function FindPropInfo(className: string, prop: string): TPropInfo | null {
  return GetClassInfo(className)?.props.find((p) => p.name === prop) ?? null;
}

/* ============================================================== TObject == */

export class TObject {
  get ClassName(): string {
    return ClassNameOf(this.constructor);
  }

  InheritsFrom(className: string): boolean {
    return InheritsFromClass(RegisteredClassOf(this), className) || this.ClassName === className;
  }

  ToString(): string {
    return this.ClassName;
  }

  /** Delphi-style destructor. Override Destroy, call Free. */
  Destroy(): void {
    /* base: nothing */
  }

  Free(): void {
    this.Destroy();
  }
}

export class TPersistent extends TObject {
  Assign(Source: TPersistent | null): void {
    if (Source) Source.AssignTo(this);
    else throw new EVclError(`${this.ClassName} nesnesine nil atanamaz`);
  }

  protected AssignTo(Dest: TPersistent): void {
    throw new EVclError(`${this.ClassName}, ${Dest.ClassName} nesnesine atanamaz`);
  }
}

/* ============================================================== TStrings == */

/** Ordered list of strings (Items, Lines, SQL, Tabs). */
export class TStrings extends TPersistent {
  protected FItems: string[] = [];
  private FUpdateCount = 0;
  private FDirty = false;
  OnChange: ((Sender: TStrings) => void) | null = null;

  get Count(): number {
    return this.FItems.length;
  }

  Get(Index: number): string {
    this.CheckIndex(Index);
    return this.FItems[Index];
  }

  Put(Index: number, S: string): void {
    this.CheckIndex(Index);
    this.FItems[Index] = String(S);
    this.Changed();
  }

  /** Read-only snapshot of the lines. */
  get Strings(): readonly string[] {
    return this.FItems.slice();
  }

  Add(S: string): number {
    this.FItems.push(String(S));
    this.Changed();
    return this.FItems.length - 1;
  }

  Append(S: string): void {
    this.Add(S);
  }

  AddStrings(Source: TStrings | readonly string[]): void {
    const items = Source instanceof TStrings ? Source.FItems : Source;
    this.FItems.push(...items.map(String));
    this.Changed();
  }

  Insert(Index: number, S: string): void {
    if (Index < 0 || Index > this.FItems.length) throw new EListError(`Liste indeksi sınır dışında (${Index})`);
    this.FItems.splice(Index, 0, String(S));
    this.Changed();
  }

  Delete(Index: number): void {
    this.CheckIndex(Index);
    this.FItems.splice(Index, 1);
    this.Changed();
  }

  Clear(): void {
    if (this.FItems.length === 0) return;
    this.FItems = [];
    this.Changed();
  }

  IndexOf(S: string): number {
    return this.FItems.indexOf(S);
  }

  Contains(S: string): boolean {
    return this.FItems.includes(S);
  }

  Exchange(Index1: number, Index2: number): void {
    this.CheckIndex(Index1);
    this.CheckIndex(Index2);
    [this.FItems[Index1], this.FItems[Index2]] = [this.FItems[Index2], this.FItems[Index1]];
    this.Changed();
  }

  Move(CurIndex: number, NewIndex: number): void {
    this.CheckIndex(CurIndex);
    const [s] = this.FItems.splice(CurIndex, 1);
    this.FItems.splice(clamp(NewIndex, 0, this.FItems.length), 0, s);
    this.Changed();
  }

  Sort(): void {
    this.FItems.sort((a, b) => a.localeCompare(b, 'tr'));
    this.Changed();
  }

  get Text(): string {
    return this.FItems.join('\n');
  }

  set Text(Value: string) {
    this.SetStrings(String(Value ?? '') === '' ? [] : String(Value).split(/\r?\n/));
  }

  get CommaText(): string {
    return this.FItems.map((s) => (/[",\s]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)).join(',');
  }

  set CommaText(Value: string) {
    const out: string[] = [];
    const re = /\s*("((?:[^"]|"")*)"|[^,]*)\s*(,|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(Value)) && m[0] !== '') {
      out.push(m[2] !== undefined ? m[2].replace(/""/g, '"') : m[1].trim());
      if (!m[3]) break;
    }
    this.SetStrings(out);
  }

  /** name=value helpers */
  Names(Index: number): string {
    const s = this.Get(Index);
    const p = s.indexOf('=');
    return p >= 0 ? s.slice(0, p) : '';
  }

  Values(Name: string): string {
    const prefix = `${Name}=`;
    const s = this.FItems.find((x) => x.startsWith(prefix));
    return s === undefined ? '' : s.slice(prefix.length);
  }

  SetValue(Name: string, Value: string): void {
    const prefix = `${Name}=`;
    const i = this.FItems.findIndex((x) => x.startsWith(prefix));
    if (i >= 0) this.Put(i, prefix + Value);
    else this.Add(prefix + Value);
  }

  ToArray(): string[] {
    return this.FItems.slice();
  }

  /** Replaces all lines at once (single OnChange). */
  SetStrings(Lines: readonly unknown[]): void {
    const next = Array.isArray(Lines) ? Lines.map((x) => String(x ?? '')) : [];
    if (sameArray(next, this.FItems)) return;
    this.FItems = next;
    this.Changed();
  }

  BeginUpdate(): void {
    this.FUpdateCount++;
  }

  EndUpdate(): void {
    if (this.FUpdateCount > 0 && --this.FUpdateCount === 0 && this.FDirty) {
      this.FDirty = false;
      this.OnChange?.(this);
    }
  }

  override Assign(Source: TPersistent | null): void {
    if (Source instanceof TStrings) this.SetStrings(Source.FItems);
    else super.Assign(Source);
  }

  toJSON(): string[] {
    return this.FItems.slice();
  }

  [Symbol.iterator](): Iterator<string> {
    return this.FItems.slice()[Symbol.iterator]();
  }

  protected Changed(): void {
    if (this.FUpdateCount > 0) {
      this.FDirty = true;
      return;
    }
    this.OnChange?.(this);
  }

  private CheckIndex(Index: number): void {
    if (!Number.isInteger(Index) || Index < 0 || Index >= this.FItems.length) {
      throw new EListError(`Liste indeksi sınır dışında (${Index})`);
    }
  }
}

export class TStringList extends TStrings {}

/* ================================================================= TFont == */

export interface TFontJSON {
  Name?: string;
  Size?: number;
  Color?: TColor;
  Style?: TFontStyle[];
}

export class TFont extends TPersistent {
  static readonly DefaultName = 'Segoe UI';
  static readonly DefaultSize = 9;
  static readonly DefaultColor: TColor = 'clWindowText';

  private FName = TFont.DefaultName;
  private FSize = TFont.DefaultSize;
  private FColor: TColor = TFont.DefaultColor;
  private FStyle: TFontStyle[] = [];
  OnChange: ((Sender: TFont) => void) | null = null;

  get Name(): string {
    return this.FName;
  }
  set Name(v: string) {
    v = String(v || TFont.DefaultName);
    if (v !== this.FName) {
      this.FName = v;
      this.Changed();
    }
  }

  /** Size in points (Delphi semantics). */
  get Size(): number {
    return this.FSize;
  }
  set Size(v: number) {
    v = clamp(Number(v) || TFont.DefaultSize, 1, 400);
    if (v !== this.FSize) {
      this.FSize = v;
      this.Changed();
    }
  }

  get Color(): TColor {
    return this.FColor;
  }
  set Color(v: TColor) {
    if (v !== this.FColor) {
      this.FColor = v;
      this.Changed();
    }
  }

  get Style(): TFontStyle[] {
    return this.FStyle.slice();
  }
  set Style(v: TFontStyle[]) {
    const next = [...new Set(Array.isArray(v) ? v : [])].sort() as TFontStyle[];
    if (!sameArray(next, this.FStyle)) {
      this.FStyle = next;
      this.Changed();
    }
  }

  /** Font height in CSS pixels. */
  get PixelSize(): number {
    return PtToPx(this.FSize);
  }

  override Assign(Source: TPersistent | null): void {
    if (Source instanceof TFont) {
      this.FromJSON(Source.toJSON());
    } else super.Assign(Source);
  }

  toJSON(): Required<TFontJSON> {
    return { Name: this.FName, Size: this.FSize, Color: this.FColor, Style: this.FStyle.slice() };
  }

  FromJSON(v: TFontJSON | null | undefined): void {
    const src = v ?? {};
    const name = String(src.Name ?? TFont.DefaultName);
    const size = clamp(Number(src.Size ?? TFont.DefaultSize) || TFont.DefaultSize, 1, 400);
    const color = String(src.Color ?? TFont.DefaultColor);
    const style = [...new Set(Array.isArray(src.Style) ? src.Style : [])].sort() as TFontStyle[];
    if (name === this.FName && size === this.FSize && color === this.FColor && sameArray(style, this.FStyle)) return;
    this.FName = name;
    this.FSize = size;
    this.FColor = color;
    this.FStyle = style;
    this.Changed();
  }

  IsDefault(): boolean {
    return (
      this.FName === TFont.DefaultName && this.FSize === TFont.DefaultSize &&
      this.FColor === TFont.DefaultColor && this.FStyle.length === 0
    );
  }

  /** Applies the font to an element's inline style (CSSOM only — CSP friendly). */
  ApplyTo(style: CSSStyleDeclaration): void {
    style.fontFamily = fontStack(this.FName);
    style.fontSize = `${this.PixelSize}px`;
    style.fontWeight = this.FStyle.includes('fsBold') ? '700' : '400';
    style.fontStyle = this.FStyle.includes('fsItalic') ? 'italic' : 'normal';
    const deco = [
      this.FStyle.includes('fsUnderline') ? 'underline' : '',
      this.FStyle.includes('fsStrikeOut') ? 'line-through' : '',
    ].filter(Boolean);
    style.textDecoration = deco.length ? deco.join(' ') : 'none';
    style.color = ColorToCSS(this.FColor);
  }

  static ClearFrom(style: CSSStyleDeclaration): void {
    style.fontFamily = '';
    style.fontSize = '';
    style.fontWeight = '';
    style.fontStyle = '';
    style.textDecoration = '';
    style.color = '';
  }

  protected Changed(): void {
    this.OnChange?.(this);
  }
}

/* ========================================================== event args == */

export interface TMouseEventArgs {
  Button: TMouseButton;
  Shift: TShiftState;
  X: number;
  Y: number;
  Event: MouseEvent;
}

export interface TKeyEventArgs {
  /** DOM key value ("Enter", "a", "ArrowUp" …). Set to "" to swallow the key. */
  Key: string;
  KeyCode: number;
  Shift: TShiftState;
  Handled: boolean;
  Event: KeyboardEvent;
}

export interface TKeyPressEventArgs {
  /** Character typed. Set to "" (Delphi: Key := #0) to cancel it. */
  Key: string;
  Handled: boolean;
  Event: KeyboardEvent;
}

export interface TCloseEventArgs {
  Action: TCloseAction;
}

export interface TCloseQueryEventArgs {
  CanClose: boolean;
}

export interface TTabChangingEventArgs {
  AllowChange: boolean;
  NewIndex: number;
}

export type TNotifyEvent = (this: any, Sender: any, e?: any) => unknown;
export type TEventHandler<A = unknown> = (this: any, Sender: any, e: A) => unknown;

function shiftOf(e: MouseEvent | KeyboardEvent): TShiftState {
  const s: TShiftState = [];
  if (e.shiftKey) s.push('ssShift');
  if (e.altKey) s.push('ssAlt');
  if (e.ctrlKey) s.push('ssCtrl');
  if (e.metaKey) s.push('ssMeta');
  if ('buttons' in e) {
    if (e.buttons & 1) s.push('ssLeft');
    if (e.buttons & 2) s.push('ssRight');
    if (e.buttons & 4) s.push('ssMiddle');
    if (e.detail === 2) s.push('ssDouble');
  }
  return s;
}

function mouseButtonOf(e: MouseEvent): TMouseButton {
  return e.button === 2 ? 'mbRight' : e.button === 1 ? 'mbMiddle' : 'mbLeft';
}

/* ============================================================ TComponent == */

/** DOM element → owning control (used by the designer for hit testing). */
export const ElementOwner = new WeakMap<Element, TControl>();

/** Resolves `this` for event handlers: Delphi handlers are methods of the owning form. */
function eventTargetOf(c: TComponent): unknown {
  let o: TComponent | null = c;
  while (o) {
    if (o instanceof TCustomForm) return o;
    o = o instanceof TControl && o.Parent ? o.Parent : o.Owner;
  }
  return c;
}

export class TComponent extends TPersistent {
  private FName = '';
  private FOwner: TComponent | null = null;
  private FComponents: TComponent[] = [];
  private FFreeNotifies: Set<TComponent> | null = null;
  protected FComponentState = new Set<TComponentStateFlag>();
  /** Free integer for user data (Delphi Tag). */
  Tag = 0;
  /** Design-time icon position of non-visual components (Delphi DesignInfo). */
  DesignLeft = 0;
  DesignTop = 0;

  constructor(AOwner: TComponent | null = null) {
    super();
    if (AOwner) {
      if (AOwner.FComponentState.has('csDesigning')) this.FComponentState.add('csDesigning');
      if (AOwner.FComponentState.has('csLoading')) this.FComponentState.add('csLoading');
      AOwner.InsertComponent(this);
    }
  }

  /** Delphi-style constructor: `TButton.Create(this)`. */
  static Create<T extends TComponent>(this: new (AOwner?: TComponent | null) => T, AOwner: TComponent | null = null): T {
    const c = new this(AOwner);
    c.AfterConstruction();
    return c;
  }

  /** Called by Create() once the instance is fully constructed. */
  AfterConstruction(): void {
    /* hook */
  }

  get Name(): string {
    return this.FName;
  }

  set Name(Value: string) {
    Value = String(Value ?? '');
    if (Value === this.FName) return;
    if (Value && !IsValidIdent(Value)) throw new EComponentError(`'${Value}' geçerli bir bileşen adı değil`);
    if (Value && this.FOwner) {
      const other = this.FOwner.FindComponent(Value);
      if (other && other !== this) throw new EComponentError(`'${Value}' adında bir bileşen zaten var`);
    }
    const old = this.FName;
    this.FName = Value;
    this.NameChanged(old, Value);
  }

  protected NameChanged(_OldName: string, _NewName: string): void {
    /* hook */
  }

  get Owner(): TComponent | null {
    return this.FOwner;
  }

  get Components(): readonly TComponent[] {
    return this.FComponents.slice();
  }

  get ComponentCount(): number {
    return this.FComponents.length;
  }

  get ComponentIndex(): number {
    return this.FOwner ? this.FOwner.FComponents.indexOf(this) : -1;
  }

  get ComponentState(): ReadonlySet<TComponentStateFlag> {
    return this.FComponentState;
  }

  get Designing(): boolean {
    return this.FComponentState.has('csDesigning');
  }

  get Loading(): boolean {
    return this.FComponentState.has('csLoading');
  }

  get Destroying(): boolean {
    return this.FComponentState.has('csDestroying');
  }

  FindComponent(AName: string): TComponent | null {
    if (!AName) return null;
    const lower = AName.toLowerCase();
    return this.FComponents.find((c) => c.FName.toLowerCase() === lower) ?? null;
  }

  InsertComponent(AComponent: TComponent): void {
    if (AComponent.FOwner === this) return;
    if (AComponent.FName) {
      const other = this.FindComponent(AComponent.FName);
      if (other) throw new EComponentError(`'${AComponent.FName}' adında bir bileşen zaten var`);
    }
    AComponent.FOwner?.RemoveComponent(AComponent);
    AComponent.FOwner = this;
    this.FComponents.push(AComponent);
    for (const c of this.FComponents) if (c !== AComponent) c.Notification(AComponent, 'opInsert');
    this.Notification(AComponent, 'opInsert');
  }

  RemoveComponent(AComponent: TComponent): void {
    const i = this.FComponents.indexOf(AComponent);
    if (i < 0) return;
    for (const c of this.FComponents) if (c !== AComponent) c.Notification(AComponent, 'opRemove');
    this.Notification(AComponent, 'opRemove');
    this.FComponents.splice(i, 1);
    AComponent.FOwner = null;
  }

  /** Changes creation order (used by the designer to keep the design file ordered). */
  SetComponentIndex(AComponent: TComponent, Index: number): void {
    const i = this.FComponents.indexOf(AComponent);
    if (i < 0) return;
    this.FComponents.splice(i, 1);
    this.FComponents.splice(clamp(Index, 0, this.FComponents.length), 0, AComponent);
  }

  /** Called when components are inserted/removed; override to clear references. */
  Notification(_AComponent: TComponent, _Operation: TOperation): void {
    /* hook */
  }

  /** Ask to be notified (opRemove) when AComponent is destroyed. */
  FreeNotification(AComponent: TComponent | null): void {
    if (!AComponent || AComponent === this) return;
    (AComponent.FFreeNotifies ??= new Set()).add(this);
    (this.FFreeNotifies ??= new Set()).add(AComponent);
  }

  RemoveFreeNotification(AComponent: TComponent | null): void {
    if (!AComponent) return;
    AComponent.FFreeNotifies?.delete(this);
    this.FFreeNotifies?.delete(AComponent);
  }

  SetDesigning(Value: boolean, Recursive = true): void {
    if (Value) this.FComponentState.add('csDesigning');
    else this.FComponentState.delete('csDesigning');
    this.DesigningChanged();
    if (Recursive) for (const c of this.FComponents) c.SetDesigning(Value, true);
  }

  protected DesigningChanged(): void {
    /* hook */
  }

  /** Marks this component and everything it owns as being streamed in. */
  BeginLoading(): void {
    this.FComponentState.add('csLoading');
    for (const c of this.FComponents) c.BeginLoading();
  }

  /** Ends streaming: owned components first (creation order), then self — like Delphi. */
  EndLoading(): void {
    for (const c of this.FComponents.slice()) c.EndLoading();
    if (this.FComponentState.has('csLoading')) this.Loaded();
  }

  /** Called once after all properties were streamed in. */
  protected Loaded(): void {
    this.FComponentState.delete('csLoading');
  }

  /**
   * Invokes an event handler with Delphi semantics: `Sender` is this component, `this`
   * inside the handler is the owning form. Exceptions (sync or async) are routed to
   * Application.HandleException instead of crashing the app.
   */
  protected Fire(handler: TEventHandler<any> | TNotifyEvent | null | undefined, e?: unknown): unknown {
    if (!handler || this.FComponentState.has('csDesigning') || this.FComponentState.has('csDestroying')) return undefined;
    try {
      const result = (handler as TEventHandler<unknown>).call(eventTargetOf(this), this, e);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).then(undefined, (err: unknown) => Application.HandleException(err, this));
      }
      return result;
    } catch (err) {
      Application.HandleException(err, this);
      return undefined;
    }
  }

  DestroyComponents(): void {
    for (const c of this.FComponents.slice().reverse()) c.Free();
  }

  override Destroy(): void {
    if (this.FComponentState.has('csDestroying')) return;
    this.FComponentState.add('csDestroying');
    if (this.FFreeNotifies) {
      for (const c of this.FFreeNotifies) {
        c.FFreeNotifies?.delete(this);
        c.Notification(this, 'opRemove');
      }
      this.FFreeNotifies = null;
    }
    this.DestroyComponents();
    this.FOwner?.RemoveComponent(this);
    super.Destroy();
  }

  override ToString(): string {
    return this.FName ? `${this.FName}: ${this.ClassName}` : this.ClassName;
  }
}

/* ============================================================== TControl == */

interface TAnchorRules {
  left: number;
  top: number;
  width: number;
  height: number;
  pw: number;
  ph: number;
}

export class TControl extends TComponent {
  protected FParent: TWinControl | null = null;
  protected FLeft = 0;
  protected FTop = 0;
  protected FWidth = 0;
  protected FHeight = 0;
  protected FAlign: TAlign = 'alNone';
  protected FAnchors: TAnchorKind[] = ['akLeft', 'akTop'];
  protected FVisible = true;
  protected FEnabled = true;
  protected FHint = '';
  protected FShowHint = false;
  protected FCursor: TCursor = 'crDefault';
  protected FColor: TColor = 'clBtnFace';
  protected FParentColor = true;
  protected FFont: TFont;
  protected FParentFont = true;
  protected FCaption = '';
  protected FElement: HTMLElement | null = null;
  protected FAnchorRules: TAnchorRules | null = null;
  protected FSettingAlignBounds = false;
  private FFontSyncing = false;

  OnClick: TNotifyEvent | null = null;
  OnDblClick: TNotifyEvent | null = null;
  OnMouseDown: TEventHandler<TMouseEventArgs> | null = null;
  OnMouseUp: TEventHandler<TMouseEventArgs> | null = null;
  OnMouseMove: TEventHandler<TMouseEventArgs> | null = null;
  OnMouseEnter: TNotifyEvent | null = null;
  OnMouseLeave: TNotifyEvent | null = null;
  OnResize: TNotifyEvent | null = null;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FFont = new TFont();
    this.FFont.OnChange = () => this.FontChanged();
    const s = this.GetDefaultSize();
    this.FWidth = s.w;
    this.FHeight = s.h;
  }

  protected GetDefaultSize(): { w: number; h: number } {
    return { w: 100, h: 24 };
  }

  /* ---------------------------------------------------------- element -- */

  /** The control's DOM element (created lazily after construction). */
  get Element(): HTMLElement {
    if (!this.FElement) this.CreateHandle();
    return this.FElement!;
  }

  get HandleAllocated(): boolean {
    return this.FElement !== null;
  }

  protected CreateElement(): HTMLElement {
    return document.createElement('div');
  }

  protected CreateHandle(): void {
    const e = this.CreateElement();
    this.FElement = e;
    e.classList.add('vcl-control', `vcl-${RegisteredClassOf(this).slice(1).toLowerCase()}`);
    if (this.Designing) e.classList.add('vcl-designing');
    ElementOwner.set(e, this);
    this.SyncNameAttr();
    this.UpdateBoundsStyle();
    this.UpdateVisibleStyle();
    this.UpdateEnabledStyle();
    this.UpdateFontStyle();
    this.UpdateColorStyle();
    this.UpdateCursorStyle();
    this.UpdateHintStyle();
    this.ElementCreated();
    this.AttachEvents(e);
  }

  /** Subclasses apply their specific state to the freshly created element here. */
  protected ElementCreated(): void {
    /* hook */
  }

  protected AttachEvents(e: HTMLElement): void {
    const mouseArgs = (ev: MouseEvent): TMouseEventArgs => {
      const r = e.getBoundingClientRect();
      return { Button: mouseButtonOf(ev), Shift: shiftOf(ev), X: Math.round(ev.clientX - r.left), Y: Math.round(ev.clientY - r.top), Event: ev };
    };
    const live = () => this.FEnabled && !this.Designing;
    e.addEventListener('click', (ev) => {
      if (live() && !this.IsInnerChildTarget(ev.target)) this.Click(ev);
    });
    e.addEventListener('dblclick', (ev) => {
      if (live() && !this.IsInnerChildTarget(ev.target)) this.Fire(this.OnDblClick, ev);
    });
    e.addEventListener('mousedown', (ev) => {
      if (live() && !this.IsInnerChildTarget(ev.target)) this.Fire(this.OnMouseDown, mouseArgs(ev));
    });
    e.addEventListener('mouseup', (ev) => {
      if (live() && !this.IsInnerChildTarget(ev.target)) this.Fire(this.OnMouseUp, mouseArgs(ev));
    });
    e.addEventListener('mousemove', (ev) => {
      if (live() && this.OnMouseMove && !this.IsInnerChildTarget(ev.target)) this.Fire(this.OnMouseMove, mouseArgs(ev));
    });
    e.addEventListener('mouseenter', (ev) => {
      if (live()) this.Fire(this.OnMouseEnter, ev);
    });
    e.addEventListener('mouseleave', (ev) => {
      if (live()) this.Fire(this.OnMouseLeave, ev);
    });
  }

  /** True when a DOM event target belongs to a child *control* (not to our own parts). */
  protected IsInnerChildTarget(target: EventTarget | null): boolean {
    let n = target as Element | null;
    while (n && n !== this.FElement) {
      const owner = ElementOwner.get(n);
      if (owner && owner !== this) return true;
      n = n.parentElement;
    }
    return false;
  }

  /** Programmatic click (Delphi Click). */
  Click(e?: MouseEvent): void {
    this.Fire(this.OnClick, e);
  }

  protected SyncNameAttr(): void {
    if (this.FElement) {
      if (this.Name) this.FElement.dataset.vclName = this.Name;
      else delete this.FElement.dataset.vclName;
    }
  }

  protected override NameChanged(OldName: string, NewName: string): void {
    super.NameChanged(OldName, NewName);
    this.SyncNameAttr();
    // Delphi designer behaviour: a caption that mirrors the name follows renames.
    if (this.Designing && this.HasCaption() && this.FCaption === OldName) this.SetCaption(NewName);
  }

  protected HasCaption(): boolean {
    return false;
  }

  protected override DesigningChanged(): void {
    super.DesigningChanged();
    this.FElement?.classList.toggle('vcl-designing', this.Designing);
    this.UpdateVisibleStyle();
  }

  /* ----------------------------------------------------------- parent -- */

  get Parent(): TWinControl | null {
    return this.FParent;
  }

  set Parent(AParent: TWinControl | null) {
    if (AParent === this.FParent) return;
    if (AParent) {
      if ((AParent as TControl) === this || AParent.IsChildOf(this)) {
        throw new EComponentError('Bir kontrol kendi alt kontrolünün içine yerleştirilemez');
      }
      if (!AParent.AcceptsControl(this)) {
        throw new EComponentError(`${AParent.ClassName} bu kontrolü içeremez`);
      }
    }
    if (this.FParent) this.FParent.RemoveControl(this);
    if (AParent) AParent.InsertControl(this);
  }

  /** Internal: invoked by TWinControl.Insert/RemoveControl. */
  SetParentInternal(AParent: TWinControl | null): void {
    this.FParent = AParent;
    this.ParentChanged();
  }

  protected ParentChanged(): void {
    if (this.FParentFont && this.FParent) this.SyncParentFont();
    this.UpdateFontStyle();
    this.UpdateColorStyle();
    this.UpdateAnchorRules();
  }

  IsChildOf(AControl: TControl): boolean {
    let p = this.FParent;
    while (p) {
      if (p === AControl) return true;
      p = p.FParent;
    }
    return false;
  }

  /* ----------------------------------------------------------- bounds -- */

  get Left(): number {
    return this.FLeft;
  }
  set Left(v: number) {
    this.SetBounds(toInt(v), this.FTop, this.FWidth, this.FHeight);
  }

  get Top(): number {
    return this.FTop;
  }
  set Top(v: number) {
    this.SetBounds(this.FLeft, toInt(v), this.FWidth, this.FHeight);
  }

  get Width(): number {
    return this.FWidth;
  }
  set Width(v: number) {
    this.SetBounds(this.FLeft, this.FTop, toInt(v), this.FHeight);
  }

  get Height(): number {
    return this.FHeight;
  }
  set Height(v: number) {
    this.SetBounds(this.FLeft, this.FTop, this.FWidth, toInt(v));
  }

  get BoundsRect(): TRect {
    return { Left: this.FLeft, Top: this.FTop, Right: this.FLeft + this.FWidth, Bottom: this.FTop + this.FHeight };
  }

  set BoundsRect(r: TRect) {
    this.SetBounds(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);
  }

  get ClientWidth(): number {
    return this.FWidth;
  }
  set ClientWidth(v: number) {
    this.Width = v;
  }

  get ClientHeight(): number {
    return this.FHeight;
  }
  set ClientHeight(v: number) {
    this.Height = v;
  }

  get ClientRect(): TRect {
    return { Left: 0, Top: 0, Right: this.ClientWidth, Bottom: this.ClientHeight };
  }

  SetBounds(ALeft: number, ATop: number, AWidth: number, AHeight: number): void {
    ALeft = toInt(ALeft);
    ATop = toInt(ATop);
    AWidth = Math.max(0, toInt(AWidth));
    AHeight = Math.max(0, toInt(AHeight));
    const moved = ALeft !== this.FLeft || ATop !== this.FTop;
    const sized = AWidth !== this.FWidth || AHeight !== this.FHeight;
    if (!moved && !sized) return;
    this.FLeft = ALeft;
    this.FTop = ATop;
    this.FWidth = AWidth;
    this.FHeight = AHeight;
    this.UpdateBoundsStyle();
    if (!this.FSettingAlignBounds) {
      this.UpdateAnchorRules();
      if (this.FAlign !== 'alNone' && this.FParent) this.FParent.Realign();
    }
    this.FParent?.ChildBoundsChanged(this);
    if (sized) this.Resized();
  }

  /** Used by the parent's alignment code: does not recapture anchors or re-trigger alignment. */
  SetAlignBounds(ALeft: number, ATop: number, AWidth: number, AHeight: number): void {
    this.FSettingAlignBounds = true;
    try {
      this.SetBounds(ALeft, ATop, AWidth, AHeight);
    } finally {
      this.FSettingAlignBounds = false;
    }
  }

  protected Resized(): void {
    if (!this.Loading) this.Fire(this.OnResize);
  }

  protected UpdateBoundsStyle(): void {
    const e = this.FElement;
    if (!e) return;
    e.style.left = `${this.FLeft}px`;
    e.style.top = `${this.FTop}px`;
    e.style.width = `${this.FWidth}px`;
    e.style.height = `${this.FHeight}px`;
  }

  /** Captures anchor distances relative to the parent's current client size. */
  UpdateAnchorRules(): void {
    const p = this.FParent;
    if (!p || this.Loading) {
      this.FAnchorRules = null;
      return;
    }
    this.FAnchorRules = {
      left: this.FLeft, top: this.FTop, width: this.FWidth, height: this.FHeight,
      pw: p.ClientWidth, ph: p.ClientHeight,
    };
  }

  /** Applies anchors after the parent's client area changed. */
  AnchorToParent(): void {
    const p = this.FParent;
    if (!p || this.FAlign !== 'alNone') return;
    const r = this.FAnchorRules;
    if (!r) {
      this.UpdateAnchorRules();
      return;
    }
    const dw = p.ClientWidth - r.pw;
    const dh = p.ClientHeight - r.ph;
    const a = this.FAnchors;
    let { left, top, width, height } = r;
    if (a.includes('akRight')) {
      if (a.includes('akLeft')) width += dw;
      else left += dw;
    } else if (!a.includes('akLeft')) left += Math.round(dw / 2);
    if (a.includes('akBottom')) {
      if (a.includes('akTop')) height += dh;
      else top += dh;
    } else if (!a.includes('akTop')) top += Math.round(dh / 2);
    this.SetAlignBounds(left, top, Math.max(0, width), Math.max(0, height));
  }

  get Align(): TAlign {
    return this.FAlign;
  }
  set Align(v: TAlign) {
    if (v === this.FAlign) return;
    const old = this.FAlign;
    this.FAlign = v;
    if (this.FParent) {
      this.FParent.Realign();
      if (v === 'alNone' && old !== 'alNone') this.UpdateAnchorRules();
    }
  }

  get Anchors(): TAnchorKind[] {
    return this.FAnchors.slice();
  }
  set Anchors(v: TAnchorKind[]) {
    const order: TAnchorKind[] = ['akLeft', 'akTop', 'akRight', 'akBottom'];
    const next = order.filter((k) => Array.isArray(v) && v.includes(k));
    if (sameArray(next, this.FAnchors)) return;
    this.FAnchors = next;
    this.UpdateAnchorRules();
  }

  /* --------------------------------------------------------- visuals -- */

  get Visible(): boolean {
    return this.FVisible;
  }
  set Visible(v: boolean) {
    v = !!v;
    if (v === this.FVisible) return;
    this.FVisible = v;
    this.UpdateVisibleStyle();
    this.VisibleChanged();
  }

  protected VisibleChanged(): void {
    if (this.FParent && this.FAlign !== 'alNone') this.FParent.Realign();
  }

  Show(): void {
    this.Visible = true;
  }

  Hide(): void {
    this.Visible = false;
  }

  /** At design time invisible controls are still drawn (Delphi behaviour). */
  get Showing(): boolean {
    return (this.FVisible || this.Designing) && (!this.FParent || this.FParent.Showing);
  }

  protected UpdateVisibleStyle(): void {
    const e = this.FElement;
    if (!e) return;
    e.style.display = this.FVisible || this.Designing ? '' : 'none';
    e.classList.toggle('vcl-hidden-design', !this.FVisible && this.Designing);
  }

  get Enabled(): boolean {
    return this.FEnabled;
  }
  set Enabled(v: boolean) {
    v = !!v;
    if (v === this.FEnabled) return;
    this.FEnabled = v;
    this.UpdateEnabledStyle();
  }

  protected UpdateEnabledStyle(): void {
    this.FElement?.classList.toggle('vcl-disabled', !this.FEnabled);
  }

  get Hint(): string {
    return this.FHint;
  }
  set Hint(v: string) {
    this.FHint = String(v ?? '');
    this.UpdateHintStyle();
  }

  get ShowHint(): boolean {
    return this.FShowHint;
  }
  set ShowHint(v: boolean) {
    this.FShowHint = !!v;
    this.UpdateHintStyle();
  }

  protected UpdateHintStyle(): void {
    const e = this.FElement;
    if (!e) return;
    if (this.FShowHint && this.FHint && !this.Designing) e.title = this.FHint;
    else e.removeAttribute('title');
  }

  get Cursor(): TCursor {
    return this.FCursor;
  }
  set Cursor(v: TCursor) {
    this.FCursor = v in CURSORS ? v : 'crDefault';
    this.UpdateCursorStyle();
  }

  protected UpdateCursorStyle(): void {
    if (this.FElement && !this.Designing) this.FElement.style.cursor = CURSORS[this.FCursor] ?? '';
  }

  get Color(): TColor {
    return this.FColor;
  }
  set Color(v: TColor) {
    this.FColor = String(v || 'clBtnFace');
    this.FParentColor = false;
    this.UpdateColorStyle();
  }

  get ParentColor(): boolean {
    return this.FParentColor;
  }
  set ParentColor(v: boolean) {
    this.FParentColor = !!v;
    if (this.FParentColor && this.FParent) this.FColor = this.FParent.Color;
    this.UpdateColorStyle();
  }

  protected UpdateColorStyle(): void {
    const e = this.ColorElement();
    if (!e) return;
    e.style.backgroundColor = this.FParentColor ? '' : ColorToCSS(this.FColor);
  }

  /** Element whose background shows Color (inputs override). */
  protected ColorElement(): HTMLElement | null {
    return this.FElement;
  }

  get Font(): TFont {
    return this.FFont;
  }
  set Font(v: TFont) {
    this.FFont.Assign(v);
  }

  get ParentFont(): boolean {
    return this.FParentFont;
  }
  set ParentFont(v: boolean) {
    v = !!v;
    this.FParentFont = v;
    if (v) this.SyncParentFont();
    this.UpdateFontStyle();
  }

  /** Copies the parent's font without clearing ParentFont. */
  SyncParentFont(): void {
    const src = this.FParent?.Font;
    if (!src) return;
    this.FFontSyncing = true;
    try {
      this.FFont.Assign(src);
    } finally {
      this.FFontSyncing = false;
    }
  }

  protected FontChanged(): void {
    if (!this.FFontSyncing) this.FParentFont = false;
    this.UpdateFontStyle();
  }

  protected UpdateFontStyle(): void {
    const e = this.FElement;
    if (!e) return;
    if (this.FParentFont) TFont.ClearFrom(e.style);
    else this.FFont.ApplyTo(e.style);
  }

  /** Caption/Text storage shared by captioned controls. */
  protected GetCaption(): string {
    return this.FCaption;
  }

  protected SetCaption(v: string): void {
    v = String(v ?? '');
    if (v === this.FCaption) return;
    this.FCaption = v;
    this.CaptionChanged();
  }

  protected CaptionChanged(): void {
    /* hook */
  }

  /* ------------------------------------------------------------ misc -- */

  BringToFront(): void {
    this.FParent?.SetChildOrder(this, Number.MAX_SAFE_INTEGER);
  }

  SendToBack(): void {
    this.FParent?.SetChildOrder(this, 0);
  }

  /** Position of this control's top-left corner relative to the viewport. */
  ClientOrigin(): TPoint {
    const r = this.Element.getBoundingClientRect();
    return { X: r.left, Y: r.top };
  }

  ScreenToClient(P: TPoint): TPoint {
    const o = this.ClientOrigin();
    return { X: P.X - o.X, Y: P.Y - o.Y };
  }

  ClientToScreen(P: TPoint): TPoint {
    const o = this.ClientOrigin();
    return { X: P.X + o.X, Y: P.Y + o.Y };
  }

  /** Repaint is automatic with the DOM; kept for Delphi source compatibility. */
  Invalidate(): void {
    /* no-op */
  }

  Repaint(): void {
    /* no-op */
  }

  Refresh(): void {
    /* no-op */
  }

  override Destroy(): void {
    if (this.Destroying) return;
    if (this.FParent) this.FParent.RemoveControl(this);
    super.Destroy();
    if (this.FElement) {
      ElementOwner.delete(this.FElement);
      this.FElement.remove();
    }
  }
}

export class TGraphicControl extends TControl {}

/* =========================================================== TWinControl == */

export class TWinControl extends TControl {
  protected FControls: TControl[] = [];
  protected FAlignLevel = 0;
  protected FAlignPending = false;
  protected FAligning = false;
  protected FTabOrder = -1;
  protected FTabStop = true;

  OnEnter: TNotifyEvent | null = null;
  OnExit: TNotifyEvent | null = null;
  OnKeyDown: TEventHandler<TKeyEventArgs> | null = null;
  OnKeyPress: TEventHandler<TKeyPressEventArgs> | null = null;
  OnKeyUp: TEventHandler<TKeyEventArgs> | null = null;

  /** Element that hosts child controls (TForm/TScrollBox override it). */
  get ClientElement(): HTMLElement {
    return this.Element;
  }

  /** Element that receives keyboard focus. */
  get FocusElement(): HTMLElement {
    return this.Element;
  }

  get Controls(): readonly TControl[] {
    return this.FControls.slice();
  }

  get ControlCount(): number {
    return this.FControls.length;
  }

  /** Containers accept child controls; plain TWinControls (TEdit…) do not at design time. */
  AcceptsControl(_AControl: TControl): boolean {
    return true;
  }

  InsertControl(AControl: TControl): void {
    if (this.FControls.includes(AControl)) return;
    this.FControls.push(AControl);
    if (AControl instanceof TWinControl && AControl.FTabOrder < 0) {
      AControl.FTabOrder = this.FControls.filter((c) => c instanceof TWinControl).length - 1;
    }
    this.ClientElement.appendChild(AControl.Element);
    AControl.SetParentInternal(this);
    if (AControl.Align !== 'alNone') this.Realign();
    this.ControlsChanged();
  }

  RemoveControl(AControl: TControl): void {
    const i = this.FControls.indexOf(AControl);
    if (i < 0) return;
    this.FControls.splice(i, 1);
    if (AControl.HandleAllocated) AControl.Element.remove();
    AControl.SetParentInternal(null);
    if (AControl.Align !== 'alNone') this.Realign();
    this.ControlsChanged();
  }

  protected ControlsChanged(): void {
    /* hook */
  }

  /** Called when a child control moved or resized (TScrollBox grows its extent). */
  ChildBoundsChanged(_AControl: TControl): void {
    /* hook */
  }

  /** Changes z-order (and DOM order) of a child control. */
  SetChildOrder(AControl: TControl, Index: number): void {
    const i = this.FControls.indexOf(AControl);
    if (i < 0) return;
    this.FControls.splice(i, 1);
    const at = clamp(Index, 0, this.FControls.length);
    this.FControls.splice(at, 0, AControl);
    const next = this.FControls[at + 1];
    if (next && next.HandleAllocated) this.ClientElement.insertBefore(AControl.Element, next.Element);
    else this.ClientElement.appendChild(AControl.Element);
  }

  ContainsControl(AControl: TControl): boolean {
    return AControl === this || AControl.IsChildOf(this);
  }

  FindChildControl(AName: string): TControl | null {
    const lower = AName.toLowerCase();
    return this.FControls.find((c) => c.Name.toLowerCase() === lower) ?? null;
  }

  /* ---------------------------------------------------------- alignment -- */

  DisableAlign(): void {
    this.FAlignLevel++;
  }

  EnableAlign(): void {
    if (this.FAlignLevel > 0 && --this.FAlignLevel === 0 && this.FAlignPending) this.Realign();
  }

  Realign(): void {
    this.AlignControls();
  }

  /** Client rectangle available for aligned children (Delphi AdjustClientRect). */
  AdjustClientRect(): TRect {
    return { Left: 0, Top: 0, Right: this.ClientWidth, Bottom: this.ClientHeight };
  }

  /**
   * Delphi TWinControl.AlignControls: alTop, alBottom, alLeft, alRight then alClient
   * consume the client rectangle. Within one alignment children are ordered by their
   * current position so dragging an aligned control in the designer reorders it.
   */
  protected AlignControls(): void {
    if (this.FAlignLevel > 0 || this.Loading) {
      this.FAlignPending = true;
      return;
    }
    if (this.FAligning) return;
    this.FAligning = true;
    this.FAlignPending = false;
    try {
      const rect = this.AdjustClientRect();
      const order: TAlign[] = ['alTop', 'alBottom', 'alLeft', 'alRight', 'alClient'];
      for (const al of order) {
        const list = this.FControls
          .map((c, idx) => ({ c, idx }))
          .filter(({ c }) => c.Align === al && (c.Visible || c.Designing));
        list.sort((a, b) => {
          const ca = a.c, cb = b.c;
          let d = 0;
          if (al === 'alTop') d = ca.Top - cb.Top;
          else if (al === 'alBottom') d = cb.Top + cb.Height - (ca.Top + ca.Height);
          else if (al === 'alLeft') d = ca.Left - cb.Left;
          else if (al === 'alRight') d = cb.Left + cb.Width - (ca.Left + ca.Width);
          return d || a.idx - b.idx;
        });
        for (const { c } of list) {
          const w = Math.max(0, rect.Right - rect.Left);
          const h = Math.max(0, rect.Bottom - rect.Top);
          switch (al) {
            case 'alTop':
              c.SetAlignBounds(rect.Left, rect.Top, w, c.Height);
              rect.Top = Math.min(rect.Bottom, rect.Top + c.Height);
              break;
            case 'alBottom':
              rect.Bottom = Math.max(rect.Top, rect.Bottom - c.Height);
              c.SetAlignBounds(rect.Left, rect.Bottom, w, c.Height);
              break;
            case 'alLeft':
              c.SetAlignBounds(rect.Left, rect.Top, c.Width, h);
              rect.Left = Math.min(rect.Right, rect.Left + c.Width);
              break;
            case 'alRight':
              rect.Right = Math.max(rect.Left, rect.Right - c.Width);
              c.SetAlignBounds(rect.Right, rect.Top, c.Width, h);
              break;
            case 'alClient':
              c.SetAlignBounds(rect.Left, rect.Top, w, h);
              break;
          }
        }
      }
    } finally {
      this.FAligning = false;
    }
  }

  protected override Resized(): void {
    if (!this.Loading) {
      for (const c of this.FControls) c.AnchorToParent();
      this.AlignControls();
    }
    super.Resized();
  }

  protected override Loaded(): void {
    super.Loaded();
    if (this.FAlignPending || this.FControls.some((c) => c.Align !== 'alNone')) this.AlignControls();
    for (const c of this.FControls) c.UpdateAnchorRules();
  }

  protected override FontChanged(): void {
    super.FontChanged();
    for (const c of this.FControls) {
      if (c.ParentFont) {
        c.SyncParentFont();
      }
    }
  }

  protected override UpdateColorStyle(): void {
    super.UpdateColorStyle();
    for (const c of this.FControls) if (c.ParentColor) c.ParentColor = true;
  }

  /* ------------------------------------------------------------ focus -- */

  get TabOrder(): number {
    return this.FTabOrder;
  }
  set TabOrder(v: number) {
    this.FTabOrder = toInt(v, -1);
  }

  get TabStop(): boolean {
    return this.FTabStop;
  }
  set TabStop(v: boolean) {
    this.FTabStop = !!v;
    this.UpdateTabIndex();
  }

  protected UpdateTabIndex(): void {
    if (!this.FElement) return;
    const fe = this.FocusElement;
    fe.tabIndex = this.Designing || !this.FTabStop || !this.FEnabled ? -1 : 0;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.UpdateTabIndex();
  }

  protected override DesigningChanged(): void {
    super.DesigningChanged();
    this.UpdateTabIndex();
  }

  protected override UpdateEnabledStyle(): void {
    super.UpdateEnabledStyle();
    this.UpdateTabIndex();
  }

  get CanFocus(): boolean {
    let c: TControl | null = this;
    while (c) {
      if (!c.Visible || !c.Enabled) return false;
      c = c.Parent;
    }
    return !this.Designing;
  }

  get Focused(): boolean {
    if (!this.FElement) return false;
    const root = this.FElement.getRootNode() as Document | ShadowRoot;
    const active = root.activeElement;
    return !!active && (active === this.FElement || this.FElement.contains(active));
  }

  SetFocus(): void {
    if (this.CanFocus) this.FocusElement.focus();
  }

  protected override AttachEvents(e: HTMLElement): void {
    super.AttachEvents(e);
    const live = () => this.FEnabled && !this.Designing;
    e.addEventListener('focusin', (ev) => {
      if (live() && !this.IsInnerChildTarget(ev.target) && !e.contains(ev.relatedTarget as Node | null)) this.Fire(this.OnEnter);
    });
    e.addEventListener('focusout', (ev) => {
      if (live() && !this.IsInnerChildTarget(ev.target) && !e.contains(ev.relatedTarget as Node | null)) this.Fire(this.OnExit);
    });
    e.addEventListener('keydown', (ev) => {
      if (!live() || this.IsInnerChildTarget(ev.target)) return;
      if (this.OnKeyDown) {
        const args: TKeyEventArgs = { Key: ev.key, KeyCode: ev.keyCode, Shift: shiftOf(ev), Handled: false, Event: ev };
        this.Fire(this.OnKeyDown, args);
        if (args.Handled || args.Key === '') {
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
      }
      if (this.OnKeyPress && (ev.key.length === 1 || ev.key === 'Enter' || ev.key === 'Escape' || ev.key === 'Backspace')) {
        const key = ev.key === 'Enter' ? '\r' : ev.key === 'Escape' ? '\x1b' : ev.key === 'Backspace' ? '\b' : ev.key;
        const args: TKeyPressEventArgs = { Key: key, Handled: false, Event: ev };
        this.Fire(this.OnKeyPress, args);
        if (args.Handled || args.Key === '') ev.preventDefault();
        else if (args.Key !== key && args.Key.length === 1 && ev.key.length === 1) {
          // Delphi lets KeyPress replace the typed character.
          ev.preventDefault();
          this.InsertTypedText(args.Key);
        }
      }
    });
    e.addEventListener('keyup', (ev) => {
      if (!live() || !this.OnKeyUp || this.IsInnerChildTarget(ev.target)) return;
      const args: TKeyEventArgs = { Key: ev.key, KeyCode: ev.keyCode, Shift: shiftOf(ev), Handled: false, Event: ev };
      this.Fire(this.OnKeyUp, args);
      if (args.Handled) ev.preventDefault();
    });
  }

  /** Used when OnKeyPress replaces the typed character (inputs override). */
  protected InsertTypedText(_Text: string): void {
    /* hook */
  }

  /** Destroying a windowed control destroys its child controls too (Delphi). */
  override Destroy(): void {
    if (this.Destroying) return;
    for (const c of this.FControls.slice().reverse()) c.Free();
    super.Destroy();
  }
}

/* ======================================================= standard controls == */

/** TLabel — static text (TGraphicControl: never receives focus). */
export class TLabel extends TGraphicControl {
  protected FAutoSize = true;
  protected FAlignment: TAlignment = 'taLeftJustify';
  protected FLayout: TTextLayout = 'tlTop';
  protected FWordWrap = false;
  protected FTransparent = true;
  protected FShowAccelChar = true;
  protected FFocusControl: TWinControl | null = null;
  private FTextEl: HTMLSpanElement | null = null;

  protected override GetDefaultSize() {
    return { w: 65, h: 15 };
  }

  protected override HasCaption(): boolean {
    return true;
  }

  get Caption(): string {
    return this.GetCaption();
  }
  set Caption(v: string) {
    this.SetCaption(v);
  }

  get AutoSize(): boolean {
    return this.FAutoSize;
  }
  set AutoSize(v: boolean) {
    this.FAutoSize = !!v;
    this.AdjustSize();
  }

  get Alignment(): TAlignment {
    return this.FAlignment;
  }
  set Alignment(v: TAlignment) {
    this.FAlignment = v;
    this.UpdateTextLayout();
  }

  get Layout(): TTextLayout {
    return this.FLayout;
  }
  set Layout(v: TTextLayout) {
    this.FLayout = v;
    this.UpdateTextLayout();
  }

  get WordWrap(): boolean {
    return this.FWordWrap;
  }
  set WordWrap(v: boolean) {
    this.FWordWrap = !!v;
    this.UpdateTextLayout();
    this.AdjustSize();
  }

  get Transparent(): boolean {
    return this.FTransparent;
  }
  set Transparent(v: boolean) {
    this.FTransparent = !!v;
    this.UpdateColorStyle();
  }

  get ShowAccelChar(): boolean {
    return this.FShowAccelChar;
  }
  set ShowAccelChar(v: boolean) {
    this.FShowAccelChar = !!v;
    this.UpdateText();
  }

  get FocusControl(): TWinControl | null {
    return this.FFocusControl;
  }
  set FocusControl(v: TWinControl | null) {
    this.FFocusControl = v;
    this.FreeNotification(v);
  }

  override Notification(AComponent: TComponent, Operation: TOperation): void {
    super.Notification(AComponent, Operation);
    if (Operation === 'opRemove' && AComponent === this.FFocusControl) this.FFocusControl = null;
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    this.FTextEl = el('span', 'vcl-label-text', e);
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.UpdateText();
    this.UpdateTextLayout();
  }

  protected override CaptionChanged(): void {
    this.UpdateText();
    this.AdjustSize();
  }

  protected override UpdateColorStyle(): void {
    const e = this.FElement;
    if (!e) return;
    e.style.backgroundColor = this.FTransparent || this.FParentColor ? '' : ColorToCSS(this.FColor);
  }

  protected override FontChanged(): void {
    super.FontChanged();
    this.AdjustSize();
  }

  protected override ParentChanged(): void {
    super.ParentChanged();
    this.AdjustSize();
  }

  protected override Loaded(): void {
    super.Loaded();
    this.AdjustSize();
  }

  get Accelerator(): string {
    return this.FShowAccelChar ? (/&([^&])/.exec(this.FCaption)?.[1] ?? '').toLowerCase() : '';
  }

  private UpdateText(): void {
    if (!this.FTextEl) return;
    renderAccelCaption(this.FTextEl, this.FCaption, this.FShowAccelChar);
    this.FElement?.classList.toggle('vcl-empty', this.FCaption === '');
  }

  private UpdateTextLayout(): void {
    const e = this.FElement;
    if (!e) return;
    e.style.justifyContent = this.FAlignment === 'taCenter' ? 'center' : this.FAlignment === 'taRightJustify' ? 'flex-end' : 'flex-start';
    e.style.textAlign = this.FAlignment === 'taCenter' ? 'center' : this.FAlignment === 'taRightJustify' ? 'right' : 'left';
    e.style.alignItems = this.FLayout === 'tlCenter' ? 'center' : this.FLayout === 'tlBottom' ? 'flex-end' : 'flex-start';
    e.classList.toggle('vcl-wordwrap', this.FWordWrap);
  }

  /** AutoSize: measures the rendered caption (requires the element to be in a document). */
  AdjustSize(): void {
    const e = this.FElement, t = this.FTextEl;
    if (!this.FAutoSize || !e || !t || this.Loading || !e.isConnected || this.FAlign === 'alClient') return;
    const r = t.getBoundingClientRect();
    if (this.FWordWrap) {
      const h = Math.max(1, Math.ceil(r.height));
      if (this.FAlign === 'alNone' || this.FAlign === 'alTop' || this.FAlign === 'alBottom') this.SetBounds(this.FLeft, this.FTop, this.FWidth, h);
      return;
    }
    const w = Math.max(1, Math.ceil(r.width));
    const h = Math.max(1, Math.ceil(r.height));
    let left = this.FLeft;
    if (this.FAlignment === 'taRightJustify') left = this.FLeft + this.FWidth - w;
    else if (this.FAlignment === 'taCenter') left = this.FLeft + Math.round((this.FWidth - w) / 2);
    if (this.FAlign === 'alLeft' || this.FAlign === 'alRight') this.SetBounds(this.FLeft, this.FTop, w, this.FHeight);
    else if (this.FAlign === 'alTop' || this.FAlign === 'alBottom') this.SetBounds(this.FLeft, this.FTop, this.FWidth, h);
    else this.SetBounds(left, this.FTop, w, h);
  }
}

/** TButton — push button. A non-zero ModalResult closes a modal form. */
export class TButton extends TWinControl {
  protected FDefault = false;
  protected FCancel = false;
  protected FModalResult: TModalResult = mrNone;
  protected FWordWrap = false;
  private FCaptionEl: HTMLSpanElement | null = null;
  private FAccel = '';

  protected override GetDefaultSize() {
    return { w: 75, h: 25 };
  }

  protected override HasCaption(): boolean {
    return true;
  }

  override AcceptsControl(): boolean {
    return false;
  }

  get Caption(): string {
    return this.GetCaption();
  }
  set Caption(v: string) {
    this.SetCaption(v);
  }

  get Default(): boolean {
    return this.FDefault;
  }
  set Default(v: boolean) {
    this.FDefault = !!v;
    this.FElement?.classList.toggle('vcl-default', this.FDefault);
  }

  get Cancel(): boolean {
    return this.FCancel;
  }
  set Cancel(v: boolean) {
    this.FCancel = !!v;
  }

  get ModalResult(): TModalResult {
    return this.FModalResult;
  }
  set ModalResult(v: TModalResult) {
    this.FModalResult = toInt(v);
  }

  get WordWrap(): boolean {
    return this.FWordWrap;
  }
  set WordWrap(v: boolean) {
    this.FWordWrap = !!v;
    this.FElement?.classList.toggle('vcl-wordwrap', this.FWordWrap);
  }

  get Accelerator(): string {
    return this.FAccel;
  }

  protected override CreateElement(): HTMLElement {
    const b = document.createElement('button');
    b.type = 'button';
    this.FCaptionEl = el('span', 'vcl-button-caption', b);
    return b;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.CaptionChanged();
    this.FElement!.classList.toggle('vcl-default', this.FDefault);
    this.FElement!.classList.toggle('vcl-wordwrap', this.FWordWrap);
  }

  protected override CaptionChanged(): void {
    if (this.FCaptionEl) this.FAccel = renderAccelCaption(this.FCaptionEl, this.FCaption);
  }

  protected override UpdateEnabledStyle(): void {
    super.UpdateEnabledStyle();
    if (this.FElement) (this.FElement as HTMLButtonElement).disabled = !this.FEnabled && !this.Designing;
  }

  override Click(e?: MouseEvent): void {
    super.Click(e);
    if (this.FModalResult !== mrNone && !this.Designing) {
      const form = GetParentForm(this);
      if (form) form.ModalResult = this.FModalResult;
    }
  }
}

/** TEdit — single line text input. */
export class TEdit extends TWinControl {
  protected FText = '';
  protected FMaxLength = 0;
  protected FPasswordChar = '';
  protected FReadOnly = false;
  protected FCharCase: TEditCharCase = 'ecNormal';
  protected FTextHint = '';
  protected FAlignment: TAlignment = 'taLeftJustify';
  protected FNumbersOnly = false;
  protected FAutoSelect = true;
  protected FBorderStyle: TBorderStyle = 'bsSingle';
  OnChange: TNotifyEvent | null = null;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FColor = 'clWindow';
    this.FParentColor = false;
  }

  protected override GetDefaultSize() {
    return { w: 121, h: 23 };
  }

  override AcceptsControl(): boolean {
    return false;
  }

  protected get Input(): HTMLInputElement {
    return this.Element as HTMLInputElement;
  }

  get Text(): string {
    return this.FText;
  }
  set Text(v: string) {
    v = this.ApplyCharCase(String(v ?? ''));
    if (v === this.FText && (!this.FElement || this.Input.value === v)) return;
    this.FText = v;
    if (this.FElement && this.Input.value !== v) this.Input.value = v;
    this.DoChange();
  }

  get MaxLength(): number {
    return this.FMaxLength;
  }
  set MaxLength(v: number) {
    this.FMaxLength = Math.max(0, toInt(v));
    this.UpdateInputAttrs();
  }

  get PasswordChar(): string {
    return this.FPasswordChar;
  }
  set PasswordChar(v: string) {
    this.FPasswordChar = String(v ?? '').slice(0, 1);
    this.UpdateInputAttrs();
  }

  get ReadOnly(): boolean {
    return this.FReadOnly;
  }
  set ReadOnly(v: boolean) {
    this.FReadOnly = !!v;
    this.UpdateInputAttrs();
  }

  get CharCase(): TEditCharCase {
    return this.FCharCase;
  }
  set CharCase(v: TEditCharCase) {
    this.FCharCase = v;
    this.Text = this.ApplyCharCase(this.FText);
  }

  get TextHint(): string {
    return this.FTextHint;
  }
  set TextHint(v: string) {
    this.FTextHint = String(v ?? '');
    this.UpdateInputAttrs();
  }

  get Alignment(): TAlignment {
    return this.FAlignment;
  }
  set Alignment(v: TAlignment) {
    this.FAlignment = v;
    this.UpdateInputAttrs();
  }

  get NumbersOnly(): boolean {
    return this.FNumbersOnly;
  }
  set NumbersOnly(v: boolean) {
    this.FNumbersOnly = !!v;
    this.UpdateInputAttrs();
  }

  get AutoSelect(): boolean {
    return this.FAutoSelect;
  }
  set AutoSelect(v: boolean) {
    this.FAutoSelect = !!v;
  }

  get BorderStyle(): TBorderStyle {
    return this.FBorderStyle;
  }
  set BorderStyle(v: TBorderStyle) {
    this.FBorderStyle = v;
    this.FElement?.classList.toggle('vcl-borderless', v === 'bsNone');
  }

  get SelStart(): number {
    return this.FElement ? this.Input.selectionStart ?? 0 : 0;
  }
  set SelStart(v: number) {
    if (this.FElement) this.Input.setSelectionRange(v, v);
  }

  get SelLength(): number {
    return this.FElement ? (this.Input.selectionEnd ?? 0) - (this.Input.selectionStart ?? 0) : 0;
  }
  set SelLength(v: number) {
    if (this.FElement) this.Input.setSelectionRange(this.SelStart, this.SelStart + Math.max(0, v));
  }

  get SelText(): string {
    return this.FText.substr(this.SelStart, this.SelLength);
  }
  set SelText(v: string) {
    this.InsertTypedText(v);
  }

  SelectAll(): void {
    if (this.FElement) this.Input.select();
  }

  Clear(): void {
    this.Text = '';
  }

  protected override CreateElement(): HTMLElement {
    const i = document.createElement('input');
    i.type = 'text';
    i.spellcheck = false;
    i.autocomplete = 'off';
    return i;
  }

  protected override ColorElement(): HTMLElement | null {
    return this.FElement;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.Input.value = this.FText;
    this.UpdateInputAttrs();
    this.FElement!.classList.toggle('vcl-borderless', this.FBorderStyle === 'bsNone');
    this.Input.addEventListener('input', () => {
      if (this.Designing) return;
      let v = this.Input.value;
      if (this.FNumbersOnly) v = v.replace(/[^0-9]/g, '');
      const cased = this.ApplyCharCase(v);
      if (cased !== this.Input.value) {
        const pos = this.Input.selectionStart;
        this.Input.value = cased;
        if (pos !== null) this.Input.setSelectionRange(pos, pos);
      }
      if (cased === this.FText) return;
      this.FText = cased;
      this.TextChangedByUser();
      this.DoChange();
    });
    this.Input.addEventListener('focus', () => {
      if (this.FAutoSelect && !this.Designing) queueMicrotask(() => this.Input.select());
    });
  }

  /** Hook for data-aware descendants. */
  protected TextChangedByUser(): void {
    /* hook */
  }

  protected DoChange(): void {
    if (!this.Loading) this.Fire(this.OnChange);
  }

  protected override InsertTypedText(Text: string): void {
    if (!this.FElement || this.FReadOnly) return;
    const i = this.Input;
    i.setRangeText(Text, i.selectionStart ?? i.value.length, i.selectionEnd ?? i.value.length, 'end');
    i.dispatchEvent(new Event('input'));
  }

  protected UpdateInputAttrs(): void {
    if (!this.FElement) return;
    const i = this.Input;
    i.type = this.FPasswordChar ? 'password' : 'text';
    i.readOnly = this.FReadOnly || this.Designing;
    i.disabled = !this.FEnabled && !this.Designing;
    i.placeholder = this.FTextHint;
    i.inputMode = this.FNumbersOnly ? 'numeric' : 'text';
    if (this.FMaxLength > 0) i.maxLength = this.FMaxLength;
    else i.removeAttribute('maxlength');
    i.style.textAlign = this.FAlignment === 'taCenter' ? 'center' : this.FAlignment === 'taRightJustify' ? 'right' : 'left';
  }

  protected override UpdateEnabledStyle(): void {
    super.UpdateEnabledStyle();
    this.UpdateInputAttrs();
  }

  protected override DesigningChanged(): void {
    super.DesigningChanged();
    this.UpdateInputAttrs();
  }

  private ApplyCharCase(v: string): string {
    if (this.FCharCase === 'ecUpperCase') return v.toLocaleUpperCase('tr');
    if (this.FCharCase === 'ecLowerCase') return v.toLocaleLowerCase('tr');
    return v;
  }
}

/** TMemo — multi line text editor bound to a TStrings (Lines). */
export class TMemo extends TWinControl {
  readonly Lines = new TStrings();
  protected FScrollBars: TScrollStyle = 'ssVertical';
  protected FWordWrap = true;
  protected FReadOnly = false;
  protected FMaxLength = 0;
  protected FAlignment: TAlignment = 'taLeftJustify';
  protected FWantTabs = false;
  private FSyncing = false;
  OnChange: TNotifyEvent | null = null;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FColor = 'clWindow';
    this.FParentColor = false;
    this.Lines.OnChange = () => {
      if (!this.FSyncing && this.FElement) (this.FElement as HTMLTextAreaElement).value = this.Lines.Text;
      if (!this.Loading) this.Fire(this.OnChange);
    };
  }

  protected override GetDefaultSize() {
    return { w: 185, h: 89 };
  }

  override AcceptsControl(): boolean {
    return false;
  }

  get Text(): string {
    return this.Lines.Text;
  }
  set Text(v: string) {
    this.Lines.Text = v;
  }

  get ScrollBars(): TScrollStyle {
    return this.FScrollBars;
  }
  set ScrollBars(v: TScrollStyle) {
    this.FScrollBars = v;
    this.UpdateMemoAttrs();
  }

  get WordWrap(): boolean {
    return this.FWordWrap;
  }
  set WordWrap(v: boolean) {
    this.FWordWrap = !!v;
    this.UpdateMemoAttrs();
  }

  get ReadOnly(): boolean {
    return this.FReadOnly;
  }
  set ReadOnly(v: boolean) {
    this.FReadOnly = !!v;
    this.UpdateMemoAttrs();
  }

  get MaxLength(): number {
    return this.FMaxLength;
  }
  set MaxLength(v: number) {
    this.FMaxLength = Math.max(0, toInt(v));
    this.UpdateMemoAttrs();
  }

  get Alignment(): TAlignment {
    return this.FAlignment;
  }
  set Alignment(v: TAlignment) {
    this.FAlignment = v;
    this.UpdateMemoAttrs();
  }

  get WantTabs(): boolean {
    return this.FWantTabs;
  }
  set WantTabs(v: boolean) {
    this.FWantTabs = !!v;
  }

  Clear(): void {
    this.Lines.Clear();
  }

  protected override CreateElement(): HTMLElement {
    const t = document.createElement('textarea');
    t.spellcheck = false;
    return t;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    const t = this.FElement as HTMLTextAreaElement;
    t.value = this.Lines.Text;
    this.UpdateMemoAttrs();
    t.addEventListener('input', () => {
      if (this.Designing) return;
      this.FSyncing = true;
      try {
        this.Lines.Text = t.value;
      } finally {
        this.FSyncing = false;
      }
    });
    t.addEventListener('keydown', (ev) => {
      if (ev.key === 'Tab' && this.FWantTabs && !this.Designing) {
        ev.preventDefault();
        this.InsertTypedText('\t');
      }
    });
  }

  protected override InsertTypedText(Text: string): void {
    const t = this.FElement as HTMLTextAreaElement | null;
    if (!t || this.FReadOnly) return;
    t.setRangeText(Text, t.selectionStart, t.selectionEnd, 'end');
    t.dispatchEvent(new Event('input'));
  }

  private UpdateMemoAttrs(): void {
    const t = this.FElement as HTMLTextAreaElement | null;
    if (!t) return;
    t.readOnly = this.FReadOnly || this.Designing;
    t.disabled = !this.FEnabled && !this.Designing;
    if (this.FMaxLength > 0) t.maxLength = this.FMaxLength;
    else t.removeAttribute('maxlength');
    t.wrap = this.FWordWrap ? 'soft' : 'off';
    const sb = this.FScrollBars;
    t.style.overflowX = sb === 'ssHorizontal' || sb === 'ssBoth' ? 'scroll' : sb === 'ssNone' ? 'hidden' : 'auto';
    t.style.overflowY = sb === 'ssVertical' || sb === 'ssBoth' ? 'scroll' : sb === 'ssNone' ? 'hidden' : 'auto';
    t.style.textAlign = this.FAlignment === 'taCenter' ? 'center' : this.FAlignment === 'taRightJustify' ? 'right' : 'left';
  }

  protected override UpdateEnabledStyle(): void {
    super.UpdateEnabledStyle();
    this.UpdateMemoAttrs();
  }

  protected override DesigningChanged(): void {
    super.DesigningChanged();
    this.UpdateMemoAttrs();
  }
}

/** TComboBox — drop-down list (csDropDownList) or editable combo (csDropDown). */
export class TComboBox extends TWinControl {
  readonly Items = new TStrings();
  protected FItemIndex = -1;
  protected FText = '';
  protected FStyle: TComboBoxStyle = 'csDropDown';
  protected FSorted = false;
  protected FDropDownCount = 8;
  protected FTextHint = '';
  private FInput: HTMLInputElement | null = null;
  private FPopup: HTMLDivElement | null = null;
  private FHot = -1;
  private FCloseHandler: ((ev: Event) => void) | null = null;
  OnChange: TNotifyEvent | null = null;
  OnSelect: TNotifyEvent | null = null;
  OnDropDown: TNotifyEvent | null = null;
  OnCloseUp: TNotifyEvent | null = null;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FColor = 'clWindow';
    this.FParentColor = false;
    this.Items.OnChange = () => {
      if (this.FSorted && !this.Loading) this.SortItemsSilently();
      if (this.FItemIndex >= this.Items.Count) this.FItemIndex = -1;
      if (this.FStyle === 'csDropDownList') this.FText = this.FItemIndex >= 0 ? this.Items.Get(this.FItemIndex) : '';
      this.SyncInput();
      if (this.FPopup) this.RenderPopup();
    };
  }

  protected override GetDefaultSize() {
    return { w: 145, h: 23 };
  }

  override AcceptsControl(): boolean {
    return false;
  }

  get ItemIndex(): number {
    return this.FItemIndex;
  }
  set ItemIndex(v: number) {
    v = toInt(v, -1);
    if (v < -1 || v >= this.Items.Count) v = -1;
    if (this.Loading) {
      this.FItemIndex = v;
      this.FText = v >= 0 && v < this.Items.Count ? this.Items.Get(v) : this.FStyle === 'csDropDownList' ? '' : this.FText;
      this.SyncInput();
      return;
    }
    if (v === this.FItemIndex) return;
    this.FItemIndex = v;
    this.FText = v >= 0 ? this.Items.Get(v) : this.FStyle === 'csDropDownList' ? '' : this.FText;
    this.SyncInput();
  }

  get Text(): string {
    return this.FText;
  }
  set Text(v: string) {
    v = String(v ?? '');
    const idx = this.Items.IndexOf(v);
    if (this.FStyle === 'csDropDownList' && idx < 0 && v !== '') return;
    this.FText = v;
    this.FItemIndex = idx;
    this.SyncInput();
  }

  get Style(): TComboBoxStyle {
    return this.FStyle;
  }
  set Style(v: TComboBoxStyle) {
    this.FStyle = v;
    this.SyncInput();
  }

  get Sorted(): boolean {
    return this.FSorted;
  }
  set Sorted(v: boolean) {
    this.FSorted = !!v;
    if (this.FSorted) this.SortItemsSilently();
  }

  get DropDownCount(): number {
    return this.FDropDownCount;
  }
  set DropDownCount(v: number) {
    this.FDropDownCount = clamp(toInt(v, 8), 1, 50);
  }

  get TextHint(): string {
    return this.FTextHint;
  }
  set TextHint(v: string) {
    this.FTextHint = String(v ?? '');
    this.SyncInput();
  }

  get DroppedDown(): boolean {
    return this.FPopup !== null;
  }
  set DroppedDown(v: boolean) {
    if (v) this.OpenPopup();
    else this.ClosePopup();
  }

  override get FocusElement(): HTMLElement {
    this.Element;
    return this.FInput!;
  }

  Clear(): void {
    this.Items.Clear();
    this.FText = '';
    this.FItemIndex = -1;
    this.SyncInput();
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    this.FInput = el('input', 'vcl-combo-input', e);
    this.FInput.type = 'text';
    this.FInput.autocomplete = 'off';
    this.FInput.spellcheck = false;
    const btn = el('div', 'vcl-combo-button', e);
    btn.appendChild(svgIcon(['M4 6l4 4 4-4'], 12, 'vcl-svg vcl-stroke'));
    btn.addEventListener('mousedown', (ev) => {
      if (this.Designing || !this.FEnabled) return;
      ev.preventDefault();
      this.FInput!.focus();
      this.DroppedDown = !this.DroppedDown;
    });
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    const input = this.FInput!;
    this.SyncInput();
    input.addEventListener('mousedown', () => {
      if (!this.Designing && this.FEnabled && this.FStyle === 'csDropDownList') queueMicrotask(() => (this.DroppedDown = !this.DroppedDown));
    });
    input.addEventListener('input', () => {
      if (this.Designing || this.FStyle === 'csDropDownList') return;
      this.FText = input.value;
      this.FItemIndex = this.Items.IndexOf(input.value);
      if (!this.Loading) this.Fire(this.OnChange);
    });
    input.addEventListener('keydown', (ev) => this.HandleKey(ev));
    input.addEventListener('blur', () => this.ClosePopup());
  }

  private HandleKey(ev: KeyboardEvent): void {
    if (this.Designing) return;
    const n = this.Items.Count;
    if ((ev.key === 'ArrowDown' && ev.altKey) || ev.key === 'F4') {
      ev.preventDefault();
      this.DroppedDown = !this.DroppedDown;
      return;
    }
    if (this.FPopup) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        this.FHot = clamp(this.FHot + (ev.key === 'ArrowDown' ? 1 : -1), 0, n - 1);
        this.RenderPopup();
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        ev.stopPropagation();
        if (this.FHot >= 0) this.SelectByUser(this.FHot);
        this.ClosePopup();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        this.ClosePopup();
      }
      return;
    }
    if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && n > 0) {
      ev.preventDefault();
      this.SelectByUser(clamp(this.FItemIndex + (ev.key === 'ArrowDown' ? 1 : -1), 0, n - 1));
    }
  }

  private SelectByUser(index: number): void {
    if (index === this.FItemIndex && this.FText === this.Items.Get(index)) return;
    this.ItemIndex = index;
    this.Fire(this.OnSelect);
    this.Fire(this.OnChange);
  }

  private SortItemsSilently(): void {
    const cur = this.FItemIndex >= 0 ? this.Items.Get(this.FItemIndex) : null;
    const sorted = this.Items.ToArray().sort((a, b) => a.localeCompare(b, 'tr'));
    const handler = this.Items.OnChange;
    this.Items.OnChange = null;
    this.Items.SetStrings(sorted);
    this.Items.OnChange = handler;
    this.FItemIndex = cur === null ? -1 : sorted.indexOf(cur);
  }

  private SyncInput(): void {
    const i = this.FInput;
    if (!i) return;
    i.value = this.FText;
    i.readOnly = this.FStyle === 'csDropDownList' || this.Designing;
    i.disabled = !this.FEnabled && !this.Designing;
    i.placeholder = this.FTextHint;
    this.FElement?.classList.toggle('vcl-dropdownlist', this.FStyle === 'csDropDownList');
  }

  protected override UpdateEnabledStyle(): void {
    super.UpdateEnabledStyle();
    this.SyncInput();
  }

  protected override DesigningChanged(): void {
    super.DesigningChanged();
    this.SyncInput();
  }

  private OpenPopup(): void {
    if (this.FPopup || this.Designing || !this.FElement) return;
    this.Fire(this.OnDropDown);
    const root = this.FElement.getRootNode() as Document | ShadowRoot;
    const host = root instanceof ShadowRoot ? root : document.body;
    const p = el('div', 'vcl-combo-popup vcl-popup', host as unknown as Node);
    this.FPopup = p;
    this.FHot = this.FItemIndex;
    this.RenderPopup();
    this.PositionPopup();
    this.FCloseHandler = (ev: Event) => {
      const t = ev.target as Node | null;
      if (t && (p.contains(t) || this.FElement?.contains(t))) return;
      this.ClosePopup();
    };
    document.addEventListener('mousedown', this.FCloseHandler, true);
    window.addEventListener('resize', this.FCloseHandler);
  }

  private PositionPopup(): void {
    const p = this.FPopup, e = this.FElement;
    if (!p || !e) return;
    const r = e.getBoundingClientRect();
    const itemH = 24;
    const h = Math.min(this.Items.Count, this.FDropDownCount) * itemH + 2;
    const below = window.innerHeight - r.bottom >= h || r.top < h;
    p.style.left = `${r.left}px`;
    p.style.top = `${below ? r.bottom + 1 : r.top - h - 1}px`;
    p.style.width = `${r.width}px`;
    p.style.maxHeight = `${this.FDropDownCount * itemH + 2}px`;
    const src = getComputedStyle(e);
    p.style.fontFamily = src.fontFamily;
    p.style.fontSize = src.fontSize;
  }

  private RenderPopup(): void {
    const p = this.FPopup;
    if (!p) return;
    p.textContent = '';
    this.Items.ToArray().forEach((text, i) => {
      const item = el('div', 'vcl-combo-item', p);
      item.textContent = text || ' ';
      if (i === this.FItemIndex) item.classList.add('vcl-selected');
      if (i === this.FHot) item.classList.add('vcl-hot');
      item.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        this.SelectByUser(i);
        this.ClosePopup();
      });
      item.addEventListener('mouseenter', () => {
        this.FHot = i;
        p.querySelectorAll('.vcl-hot').forEach((x) => x.classList.remove('vcl-hot'));
        item.classList.add('vcl-hot');
      });
    });
    const hot = p.children[Math.max(0, this.FHot)] as HTMLElement | undefined;
    hot?.scrollIntoView({ block: 'nearest' });
  }

  private ClosePopup(): void {
    if (!this.FPopup) return;
    this.FPopup.remove();
    this.FPopup = null;
    if (this.FCloseHandler) {
      document.removeEventListener('mousedown', this.FCloseHandler, true);
      window.removeEventListener('resize', this.FCloseHandler);
      this.FCloseHandler = null;
    }
    this.Fire(this.OnCloseUp);
  }

  override Destroy(): void {
    this.ClosePopup();
    super.Destroy();
  }
}

/** Shared base of TCheckBox / TRadioButton. */
export abstract class TButtonControl extends TWinControl {
  protected FAlignment: TLeftRight = 'taRightJustify';
  protected FWordWrap = false;
  protected FBoxEl: HTMLSpanElement | null = null;
  protected FCaptionEl: HTMLSpanElement | null = null;

  protected override HasCaption(): boolean {
    return true;
  }

  override AcceptsControl(): boolean {
    return false;
  }

  get Caption(): string {
    return this.GetCaption();
  }
  set Caption(v: string) {
    this.SetCaption(v);
  }

  get Alignment(): TLeftRight {
    return this.FAlignment;
  }
  set Alignment(v: TLeftRight) {
    this.FAlignment = v;
    this.FElement?.classList.toggle('vcl-box-right', v === 'taLeftJustify');
  }

  get WordWrap(): boolean {
    return this.FWordWrap;
  }
  set WordWrap(v: boolean) {
    this.FWordWrap = !!v;
    this.FElement?.classList.toggle('vcl-wordwrap', this.FWordWrap);
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    this.FBoxEl = el('span', 'vcl-check-box', e);
    this.FCaptionEl = el('span', 'vcl-check-caption', e);
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.CaptionChanged();
    this.FElement!.classList.toggle('vcl-box-right', this.FAlignment === 'taLeftJustify');
    this.FElement!.classList.toggle('vcl-wordwrap', this.FWordWrap);
    this.UpdateCheckStyle();
    this.FElement!.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' && !this.Designing && this.FEnabled) {
        ev.preventDefault();
        this.Click();
      }
    });
  }

  protected override CaptionChanged(): void {
    if (this.FCaptionEl) renderAccelCaption(this.FCaptionEl, this.FCaption);
  }

  protected abstract UpdateCheckStyle(): void;
}

/** TCheckBox — two or three state check box. OnClick fires whenever State changes. */
export class TCheckBox extends TButtonControl {
  protected FState: TCheckBoxState = 'cbUnchecked';
  protected FAllowGrayed = false;

  protected override GetDefaultSize() {
    return { w: 97, h: 17 };
  }

  get Checked(): boolean {
    return this.FState === 'cbChecked';
  }
  set Checked(v: boolean) {
    this.State = v ? 'cbChecked' : 'cbUnchecked';
  }

  get State(): TCheckBoxState {
    return this.FState;
  }
  set State(v: TCheckBoxState) {
    if (v === this.FState) return;
    this.FState = v;
    this.UpdateCheckStyle();
    if (!this.Loading) super.Click();
  }

  get AllowGrayed(): boolean {
    return this.FAllowGrayed;
  }
  set AllowGrayed(v: boolean) {
    this.FAllowGrayed = !!v;
  }

  /** User click toggles the state (which fires OnClick once). */
  override Click(): void {
    if (this.Designing) return;
    switch (this.FState) {
      case 'cbUnchecked':
        this.State = 'cbChecked';
        break;
      case 'cbChecked':
        this.State = this.FAllowGrayed ? 'cbGrayed' : 'cbUnchecked';
        break;
      default:
        this.State = 'cbUnchecked';
    }
  }

  protected UpdateCheckStyle(): void {
    const e = this.FElement;
    if (!e) return;
    e.setAttribute('role', 'checkbox');
    e.setAttribute('aria-checked', this.FState === 'cbGrayed' ? 'mixed' : String(this.FState === 'cbChecked'));
    e.classList.toggle('vcl-checked', this.FState === 'cbChecked');
    e.classList.toggle('vcl-grayed', this.FState === 'cbGrayed');
  }
}

/** TRadioButton — mutually exclusive with sibling radio buttons of the same parent. */
export class TRadioButton extends TButtonControl {
  protected FChecked = false;

  protected override GetDefaultSize() {
    return { w: 113, h: 17 };
  }

  get Checked(): boolean {
    return this.FChecked;
  }
  set Checked(v: boolean) {
    v = !!v;
    if (v === this.FChecked) return;
    this.FChecked = v;
    this.UpdateCheckStyle();
    if (v) {
      for (const c of this.FParent?.Controls ?? []) {
        if (c !== this && c instanceof TRadioButton && c.FChecked) {
          c.FChecked = false;
          c.UpdateCheckStyle();
        }
      }
      if (!this.Loading) super.Click();
    }
  }

  override Click(): void {
    if (!this.Designing) this.Checked = true;
  }

  protected UpdateCheckStyle(): void {
    const e = this.FElement;
    if (!e) return;
    e.setAttribute('role', 'radio');
    e.setAttribute('aria-checked', String(this.FChecked));
    e.classList.toggle('vcl-checked', this.FChecked);
  }
}

/**
 * Resolves project asset paths such as "assets/logo.png". Generated apps load them
 * relative to the page; the IDE designer points the resolver at the preview server.
 */
export const AssetResolver = {
  Resolve: (Src: string): string => Src,
};

/** TImage — displays a picture (URL, project asset path or data: URI). */
export class TImage extends TGraphicControl {
  protected FPicture = '';
  protected FStretch = false;
  protected FProportional = false;
  protected FCenter = false;
  private FImg: HTMLImageElement | null = null;

  protected override GetDefaultSize() {
    return { w: 105, h: 105 };
  }

  get Picture(): string {
    return this.FPicture;
  }
  set Picture(v: string) {
    v = String(v ?? '').trim();
    if (!IsSafeImageSource(v)) throw new EVclError('Güvensiz resim kaynağı reddedildi');
    this.FPicture = v;
    this.UpdateImage();
  }

  get Stretch(): boolean {
    return this.FStretch;
  }
  set Stretch(v: boolean) {
    this.FStretch = !!v;
    this.UpdateImage();
  }

  get Proportional(): boolean {
    return this.FProportional;
  }
  set Proportional(v: boolean) {
    this.FProportional = !!v;
    this.UpdateImage();
  }

  get Center(): boolean {
    return this.FCenter;
  }
  set Center(v: boolean) {
    this.FCenter = !!v;
    this.UpdateImage();
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    this.FImg = el('img', 'vcl-image-img', e);
    this.FImg.alt = '';
    this.FImg.draggable = false;
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.UpdateImage();
  }

  private UpdateImage(): void {
    const img = this.FImg;
    if (!img) return;
    if (this.FPicture) img.src = AssetResolver.Resolve(this.FPicture);
    else img.removeAttribute('src');
    img.style.display = this.FPicture ? '' : 'none';
    img.style.objectFit = this.FStretch ? (this.FProportional ? 'contain' : 'fill') : 'none';
    img.style.objectPosition = this.FCenter ? 'center' : 'left top';
    this.FElement?.classList.toggle('vcl-empty', !this.FPicture);
  }
}

/** TProgressBar — determinate or marquee progress indicator. */
export class TProgressBar extends TWinControl {
  protected FMin = 0;
  protected FMax = 100;
  protected FPosition = 0;
  protected FStep = 10;
  protected FOrientation: TProgressBarOrientation = 'pbHorizontal';
  protected FBarState: TProgressBarState = 'pbsNormal';
  protected FMarquee = false;
  private FBar: HTMLDivElement | null = null;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FTabStop = false;
  }

  protected override GetDefaultSize() {
    return { w: 150, h: 17 };
  }

  override AcceptsControl(): boolean {
    return false;
  }

  get Min(): number {
    return this.FMin;
  }
  set Min(v: number) {
    this.FMin = toInt(v);
    this.UpdateBar();
  }

  get Max(): number {
    return this.FMax;
  }
  set Max(v: number) {
    this.FMax = toInt(v, 100);
    this.UpdateBar();
  }

  get Position(): number {
    return this.FPosition;
  }
  set Position(v: number) {
    this.FPosition = clamp(toInt(v), Math.min(this.FMin, this.FMax), Math.max(this.FMin, this.FMax));
    this.UpdateBar();
  }

  get Step(): number {
    return this.FStep;
  }
  set Step(v: number) {
    this.FStep = toInt(v, 10);
  }

  get Orientation(): TProgressBarOrientation {
    return this.FOrientation;
  }
  set Orientation(v: TProgressBarOrientation) {
    this.FOrientation = v;
    this.UpdateBar();
  }

  get State(): TProgressBarState {
    return this.FBarState;
  }
  set State(v: TProgressBarState) {
    this.FBarState = v;
    this.UpdateBar();
  }

  get Marquee(): boolean {
    return this.FMarquee;
  }
  set Marquee(v: boolean) {
    this.FMarquee = !!v;
    this.UpdateBar();
  }

  StepIt(): void {
    let p = this.FPosition + this.FStep;
    if (p > this.FMax) p = this.FMin + (p - this.FMax);
    this.Position = p;
  }

  StepBy(Delta: number): void {
    this.Position = this.FPosition + toInt(Delta);
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    e.setAttribute('role', 'progressbar');
    this.FBar = el('div', 'vcl-progress-bar', e);
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.UpdateBar();
  }

  private UpdateBar(): void {
    const e = this.FElement, bar = this.FBar;
    if (!e || !bar) return;
    const range = this.FMax - this.FMin;
    const pct = range === 0 ? 0 : clamp(((this.FPosition - this.FMin) / range) * 100, 0, 100);
    const vertical = this.FOrientation === 'pbVertical';
    e.classList.toggle('vcl-vertical', vertical);
    e.classList.toggle('vcl-marquee', this.FMarquee);
    e.classList.toggle('vcl-error', this.FBarState === 'pbsError');
    e.classList.toggle('vcl-paused', this.FBarState === 'pbsPaused');
    bar.style.width = vertical || this.FMarquee ? '' : `${pct}%`;
    bar.style.height = vertical && !this.FMarquee ? `${pct}%` : '';
    e.setAttribute('aria-valuemin', String(this.FMin));
    e.setAttribute('aria-valuemax', String(this.FMax));
    e.setAttribute('aria-valuenow', String(this.FPosition));
  }
}

/** TPanel — container with optional caption and bevels. */
export class TPanel extends TWinControl {
  protected FBevelOuter: TBevelCut = 'bvRaised';
  protected FBevelInner: TBevelCut = 'bvNone';
  protected FBevelWidth = 1;
  protected FBorderStyle: TBorderStyle = 'bsNone';
  protected FAlignment: TAlignment = 'taCenter';
  protected FVerticalAlignment: TTextLayout = 'tlCenter';
  protected FShowCaption = true;
  private FCaptionEl: HTMLSpanElement | null = null;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FParentColor = false;
    this.FColor = 'clBtnFace';
    this.FTabStop = false;
  }

  protected override GetDefaultSize() {
    return { w: 185, h: 41 };
  }

  protected override HasCaption(): boolean {
    return true;
  }

  get Caption(): string {
    return this.GetCaption();
  }
  set Caption(v: string) {
    this.SetCaption(v);
  }

  get BevelOuter(): TBevelCut {
    return this.FBevelOuter;
  }
  set BevelOuter(v: TBevelCut) {
    this.FBevelOuter = v;
    this.UpdatePanelStyle();
  }

  get BevelInner(): TBevelCut {
    return this.FBevelInner;
  }
  set BevelInner(v: TBevelCut) {
    this.FBevelInner = v;
    this.UpdatePanelStyle();
  }

  get BevelWidth(): number {
    return this.FBevelWidth;
  }
  set BevelWidth(v: number) {
    this.FBevelWidth = clamp(toInt(v, 1), 1, 20);
    this.UpdatePanelStyle();
  }

  get BorderStyle(): TBorderStyle {
    return this.FBorderStyle;
  }
  set BorderStyle(v: TBorderStyle) {
    this.FBorderStyle = v;
    this.UpdatePanelStyle();
  }

  get Alignment(): TAlignment {
    return this.FAlignment;
  }
  set Alignment(v: TAlignment) {
    this.FAlignment = v;
    this.UpdatePanelStyle();
  }

  get VerticalAlignment(): TTextLayout {
    return this.FVerticalAlignment;
  }
  set VerticalAlignment(v: TTextLayout) {
    this.FVerticalAlignment = v;
    this.UpdatePanelStyle();
  }

  get ShowCaption(): boolean {
    return this.FShowCaption;
  }
  set ShowCaption(v: boolean) {
    this.FShowCaption = !!v;
    this.UpdatePanelStyle();
  }

  override AdjustClientRect(): TRect {
    const inset = this.BevelInset();
    return { Left: inset, Top: inset, Right: this.ClientWidth - inset, Bottom: this.ClientHeight - inset };
  }

  private BevelInset(): number {
    return (this.FBevelOuter !== 'bvNone' ? this.FBevelWidth : 0) + (this.FBevelInner !== 'bvNone' ? this.FBevelWidth : 0) + (this.FBorderStyle === 'bsSingle' ? 1 : 0);
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    this.FCaptionEl = el('span', 'vcl-panel-caption', e);
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.CaptionChanged();
    this.UpdatePanelStyle();
  }

  protected override CaptionChanged(): void {
    if (this.FCaptionEl) renderAccelCaption(this.FCaptionEl, this.FCaption);
  }

  private UpdatePanelStyle(): void {
    const e = this.FElement, c = this.FCaptionEl;
    if (!e || !c) return;
    const w = this.FBevelWidth;
    const shadow = (cut: TBevelCut, offset: number): string[] => {
      if (cut === 'bvNone' || cut === 'bvSpace') return [];
      const light = 'var(--vcl-btnhighlight, #fff)';
      const dark = 'var(--vcl-btnshadow, #a0a0a0)';
      const [tl, br] = cut === 'bvRaised' ? [light, dark] : [dark, light];
      const d = offset + w;
      return [`inset ${d}px ${d}px 0 -${offset}px ${tl}`, `inset -${d}px -${d}px 0 -${offset}px ${br}`];
    };
    const layers = [...shadow(this.FBevelOuter, 0), ...shadow(this.FBevelInner, this.FBevelOuter !== 'bvNone' ? w : 0)];
    if (this.FBorderStyle === 'bsSingle') layers.unshift('inset 0 0 0 1px var(--vcl-windowframe, #646464)');
    e.style.boxShadow = layers.join(', ');
    c.style.display = this.FShowCaption ? '' : 'none';
    c.style.justifyContent = this.FAlignment === 'taCenter' ? 'center' : this.FAlignment === 'taRightJustify' ? 'flex-end' : 'flex-start';
    c.style.alignItems = this.FVerticalAlignment === 'tlCenter' ? 'center' : this.FVerticalAlignment === 'tlBottom' ? 'flex-end' : 'flex-start';
    const inset = this.BevelInset() + 2;
    c.style.padding = `${inset}px`;
    if (!this.Loading) this.Realign();
  }
}

/** TGroupBox — framed container with a caption. */
export class TGroupBox extends TWinControl {
  private FLegend: HTMLLegendElement | null = null;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FTabStop = false;
  }

  protected override GetDefaultSize() {
    return { w: 185, h: 105 };
  }

  protected override HasCaption(): boolean {
    return true;
  }

  get Caption(): string {
    return this.GetCaption();
  }
  set Caption(v: string) {
    this.SetCaption(v);
  }

  override AdjustClientRect(): TRect {
    const top = Math.ceil(this.FFont.PixelSize * 1.35) + 4;
    return { Left: 4, Top: top, Right: this.ClientWidth - 4, Bottom: this.ClientHeight - 4 };
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    const fs = el('fieldset', 'vcl-groupbox-frame', e);
    this.FLegend = el('legend', 'vcl-groupbox-caption', fs);
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.CaptionChanged();
  }

  protected override CaptionChanged(): void {
    if (!this.FLegend) return;
    renderAccelCaption(this.FLegend, this.FCaption);
    this.FLegend.style.display = this.FCaption ? '' : 'none';
  }
}

/** TTabControl — tab strip with a single client area (Delphi semantics). */
export class TTabControl extends TWinControl {
  readonly Tabs = new TStrings();
  protected FTabIndex = -1;
  protected FTabPosition: TTabPosition = 'tpTop';
  private FStrip: HTMLDivElement | null = null;
  OnChange: TNotifyEvent | null = null;
  OnChanging: TEventHandler<TTabChangingEventArgs> | null = null;

  static readonly TabStripHeight = 28;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.Tabs.OnChange = () => {
      if (this.FTabIndex >= this.Tabs.Count) this.FTabIndex = this.Tabs.Count - 1;
      if (this.FTabIndex < 0 && this.Tabs.Count > 0 && !this.Loading) this.FTabIndex = 0;
      this.RenderTabs();
    };
  }

  protected override GetDefaultSize() {
    return { w: 289, h: 193 };
  }

  get TabIndex(): number {
    return this.FTabIndex;
  }
  set TabIndex(v: number) {
    v = clamp(toInt(v, -1), -1, this.Tabs.Count - 1);
    if (v === this.FTabIndex) return;
    this.FTabIndex = v;
    this.RenderTabs();
    if (!this.Loading) this.Fire(this.OnChange);
  }

  get TabPosition(): TTabPosition {
    return this.FTabPosition;
  }
  set TabPosition(v: TTabPosition) {
    this.FTabPosition = v;
    this.FElement?.classList.toggle('vcl-tabs-bottom', v === 'tpBottom');
    if (!this.Loading) this.Realign();
  }

  override AdjustClientRect(): TRect {
    const h = TTabControl.TabStripHeight;
    return this.FTabPosition === 'tpTop'
      ? { Left: 4, Top: h + 4, Right: this.ClientWidth - 4, Bottom: this.ClientHeight - 4 }
      : { Left: 4, Top: 4, Right: this.ClientWidth - 4, Bottom: this.ClientHeight - h - 4 };
  }

  /** Index of the tab at a point in control coordinates (-1 when none) — used by the designer. */
  TabAtPoint(X: number, Y: number): number {
    if (!this.FStrip) return -1;
    const base = this.Element.getBoundingClientRect();
    const tabs = Array.from(this.FStrip.children) as HTMLElement[];
    return tabs.findIndex((t) => {
      const r = t.getBoundingClientRect();
      const x = X + base.left, y = Y + base.top;
      return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
    });
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    el('div', 'vcl-tab-frame', e);
    this.FStrip = el('div', 'vcl-tab-strip', e);
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.FElement!.classList.toggle('vcl-tabs-bottom', this.FTabPosition === 'tpBottom');
    this.RenderTabs();
  }

  private RenderTabs(): void {
    const strip = this.FStrip;
    if (!strip) return;
    strip.textContent = '';
    this.Tabs.ToArray().forEach((text, i) => {
      const t = el('div', 'vcl-tab', strip);
      renderAccelCaption(t, text);
      if (i === this.FTabIndex) t.classList.add('vcl-active');
      t.addEventListener('mousedown', (ev) => {
        if (this.Designing || !this.FEnabled || i === this.FTabIndex) return;
        ev.preventDefault();
        const args: TTabChangingEventArgs = { AllowChange: true, NewIndex: i };
        this.Fire(this.OnChanging, args);
        if (args.AllowChange) this.TabIndex = i;
      });
    });
  }
}

/** TScrollBox — scrollable container; children are positioned in a content layer. */
export class TScrollBox extends TWinControl {
  protected FBorderStyle: TBorderStyle = 'bsSingle';
  protected FAutoScroll = true;
  private FContent: HTMLDivElement | null = null;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FTabStop = false;
  }

  protected override GetDefaultSize() {
    return { w: 185, h: 121 };
  }

  override get ClientElement(): HTMLElement {
    this.Element;
    return this.FContent!;
  }

  get BorderStyle(): TBorderStyle {
    return this.FBorderStyle;
  }
  set BorderStyle(v: TBorderStyle) {
    this.FBorderStyle = v;
    this.FElement?.classList.toggle('vcl-borderless', v === 'bsNone');
  }

  get AutoScroll(): boolean {
    return this.FAutoScroll;
  }
  set AutoScroll(v: boolean) {
    this.FAutoScroll = !!v;
    if (this.FElement) this.FElement.style.overflow = this.FAutoScroll ? 'auto' : 'hidden';
  }

  get HorzScrollPos(): number {
    return this.FElement?.scrollLeft ?? 0;
  }
  set HorzScrollPos(v: number) {
    if (this.FElement) this.FElement.scrollLeft = v;
  }

  get VertScrollPos(): number {
    return this.FElement?.scrollTop ?? 0;
  }
  set VertScrollPos(v: number) {
    if (this.FElement) this.FElement.scrollTop = v;
  }

  ScrollInView(AControl: TControl): void {
    if (AControl.HandleAllocated) AControl.Element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  override ClientOrigin(): TPoint {
    const r = this.ClientElement.getBoundingClientRect();
    return { X: r.left, Y: r.top };
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    this.FContent = el('div', 'vcl-scrollbox-content', e);
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.FElement!.classList.toggle('vcl-borderless', this.FBorderStyle === 'bsNone');
    this.FElement!.style.overflow = this.FAutoScroll ? 'auto' : 'hidden';
    this.UpdateExtent();
  }

  /** Grows the content layer so every child is reachable by scrolling. */
  UpdateExtent(): void {
    const c = this.FContent;
    if (!c) return;
    let w = 0, h = 0;
    for (const ctl of this.FControls) {
      if (!ctl.Visible && !ctl.Designing) continue;
      w = Math.max(w, ctl.Left + ctl.Width);
      h = Math.max(h, ctl.Top + ctl.Height);
    }
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
  }

  protected override ControlsChanged(): void {
    super.ControlsChanged();
    this.UpdateExtent();
  }

  override ChildBoundsChanged(): void {
    this.UpdateExtent();
  }
}

/** TTimer — non-visual periodic event source. Never runs at design time. */
export class TTimer extends TComponent {
  protected FEnabled = true;
  protected FInterval = 1000;
  private FOnTimer: TNotifyEvent | null = null;
  private FHandle: ReturnType<typeof setInterval> | null = null;

  get Enabled(): boolean {
    return this.FEnabled;
  }
  set Enabled(v: boolean) {
    this.FEnabled = !!v;
    this.UpdateTimer();
  }

  get Interval(): number {
    return this.FInterval;
  }
  set Interval(v: number) {
    this.FInterval = Math.max(0, toInt(v, 1000));
    this.UpdateTimer();
  }

  get OnTimer(): TNotifyEvent | null {
    return this.FOnTimer;
  }
  set OnTimer(v: TNotifyEvent | null) {
    this.FOnTimer = v;
    this.UpdateTimer();
  }

  protected override Loaded(): void {
    super.Loaded();
    this.UpdateTimer();
  }

  protected override DesigningChanged(): void {
    super.DesigningChanged();
    this.UpdateTimer();
  }

  private UpdateTimer(): void {
    if (this.FHandle !== null) {
      clearInterval(this.FHandle);
      this.FHandle = null;
    }
    if (!HAS_DOM || !this.FEnabled || this.FInterval <= 0 || !this.FOnTimer || this.Designing || this.Loading || this.Destroying) return;
    this.FHandle = setInterval(() => this.Fire(this.FOnTimer), this.FInterval);
  }

  override Destroy(): void {
    if (this.FHandle !== null) clearInterval(this.FHandle);
    this.FHandle = null;
    super.Destroy();
  }
}

/* ================================================================ forms == */

export type TFormClass<T extends TCustomForm = TCustomForm> = {
  new (AOwner?: TComponent | null): T;
  prototype: T;
  Create(this: new (AOwner?: TComponent | null) => T, AOwner?: TComponent | null): T;
};

type TFormStateFlag = 'fsCreating' | 'fsModal' | 'fsShown' | 'fsActive';

export function GetParentForm(AControl: TControl | null): TCustomForm | null {
  let c: TControl | null = AControl;
  while (c) {
    if (c instanceof TCustomForm) return c;
    c = c.Parent;
  }
  return null;
}

/**
 * TCustomForm — a window. The same class renders the form in the IDE designer (inside a
 * shadow root, csDesigning) and in the running application (inside the VCL desktop).
 */
export class TCustomForm extends TWinControl {
  protected FBorderStyle: TFormBorderStyle = 'bsSizeable';
  protected FBorderIcons: TBorderIcon[] = ['biSystemMenu', 'biMinimize', 'biMaximize'];
  protected FPosition: TPosition = 'poScreenCenter';
  protected FWindowState: TWindowState = 'wsNormal';
  protected FKeyPreview = false;
  protected FModalResult: TModalResult = mrNone;
  protected FActiveControl: TWinControl | null = null;
  protected FFormState = new Set<TFormStateFlag>();
  private FTitleBar: HTMLDivElement | null = null;
  private FCaptionEl: HTMLSpanElement | null = null;
  private FClientEl: HTMLDivElement | null = null;
  private FSizeGrip: HTMLDivElement | null = null;
  private FModalResolve: ((mr: TModalResult) => void) | null = null;
  private FModalOverlay: HTMLDivElement | null = null;
  private FRestoreBounds: TRect | null = null;

  OnCreate: TNotifyEvent | null = null;
  OnDestroy: TNotifyEvent | null = null;
  OnShow: TNotifyEvent | null = null;
  OnHide: TNotifyEvent | null = null;
  OnClose: TEventHandler<TCloseEventArgs> | null = null;
  OnCloseQuery: TEventHandler<TCloseQueryEventArgs> | null = null;
  OnActivate: TNotifyEvent | null = null;
  OnDeactivate: TNotifyEvent | null = null;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FParentFont = false;
    this.FParentColor = false;
    this.FColor = 'clBtnFace';
    this.FVisible = false;
    this.FTabStop = false;
    const f = this.FrameMetrics();
    this.FWidth = 624 + f.border * 2;
    this.FHeight = 441 + f.title + f.border * 2;
  }

  /* ------------------------------------------------ singleton helpers -- */

  /** Delphi global form variable: `Form2.Instance` (auto-created by Application). */
  static GetInstance<T extends TCustomForm>(this: TFormClass<T>): T {
    return Application.FindFormInstance(this) ?? Application.CreateForm(this);
  }

  /** `Form2.Show()` — shows the auto-created instance (Delphi: Form2.Show). */
  static Show<T extends TCustomForm>(this: TFormClass<T>): T {
    const f = Application.FindFormInstance(this) ?? Application.CreateForm(this);
    f.Show();
    return f;
  }

  /** `await Form2.ShowModal()` — shows the auto-created instance modally. */
  static ShowModal<T extends TCustomForm>(this: TFormClass<T>): Promise<TModalResult> {
    const f = Application.FindFormInstance(this) ?? Application.CreateForm(this);
    return f.ShowModal();
  }

  static Hide<T extends TCustomForm>(this: TFormClass<T>): void {
    Application.FindFormInstance(this)?.Hide();
  }

  static Close<T extends TCustomForm>(this: TFormClass<T>): void {
    Application.FindFormInstance(this)?.Close();
  }

  /* ---------------------------------------------------------- frame -- */

  FrameMetrics(): { border: number; title: number } {
    switch (this.FBorderStyle) {
      case 'bsNone':
        return { border: 0, title: 0 };
      case 'bsToolWindow':
      case 'bsSizeToolWin':
        return { border: 1, title: 26 };
      default:
        return { border: 1, title: 32 };
    }
  }

  override get ClientWidth(): number {
    return Math.max(0, this.FWidth - this.FrameMetrics().border * 2);
  }
  override set ClientWidth(v: number) {
    this.Width = toInt(v) + this.FrameMetrics().border * 2;
  }

  override get ClientHeight(): number {
    const f = this.FrameMetrics();
    return Math.max(0, this.FHeight - f.title - f.border * 2);
  }
  override set ClientHeight(v: number) {
    const f = this.FrameMetrics();
    this.Height = toInt(v) + f.title + f.border * 2;
  }

  override get ClientElement(): HTMLElement {
    this.Element;
    return this.FClientEl!;
  }

  override ClientOrigin(): TPoint {
    const r = this.ClientElement.getBoundingClientRect();
    return { X: r.left, Y: r.top };
  }

  /** In the designer the window always sits at the surface origin; Left/Top only matter at runtime. */
  protected override UpdateBoundsStyle(): void {
    super.UpdateBoundsStyle();
    if (this.Designing && this.FElement) {
      this.FElement.style.left = '0px';
      this.FElement.style.top = '0px';
    }
  }

  protected override DesigningChanged(): void {
    super.DesigningChanged();
    this.UpdateBoundsStyle();
  }

  protected override HasCaption(): boolean {
    return true;
  }

  get Caption(): string {
    return this.GetCaption();
  }
  set Caption(v: string) {
    this.SetCaption(v);
  }

  get BorderStyle(): TFormBorderStyle {
    return this.FBorderStyle;
  }
  set BorderStyle(v: TFormBorderStyle) {
    if (v === this.FBorderStyle) return;
    const cw = this.ClientWidth, ch = this.ClientHeight;
    this.FBorderStyle = v;
    this.UpdateFrame();
    this.SetBounds(this.FLeft, this.FTop, cw + this.FrameMetrics().border * 2, ch + this.FrameMetrics().title + this.FrameMetrics().border * 2);
  }

  get BorderIcons(): TBorderIcon[] {
    return this.FBorderIcons.slice();
  }
  set BorderIcons(v: TBorderIcon[]) {
    this.FBorderIcons = Array.isArray(v) ? v.slice() : [];
    this.UpdateFrame();
  }

  get Position(): TPosition {
    return this.FPosition;
  }
  set Position(v: TPosition) {
    this.FPosition = v;
  }

  get WindowState(): TWindowState {
    return this.FWindowState;
  }
  set WindowState(v: TWindowState) {
    if (v === this.FWindowState) return;
    const old = this.FWindowState;
    this.FWindowState = v;
    if (this.Designing || this.Loading || !this.FVisible) return;
    this.ApplyWindowState(old);
  }

  get KeyPreview(): boolean {
    return this.FKeyPreview;
  }
  set KeyPreview(v: boolean) {
    this.FKeyPreview = !!v;
  }

  get ActiveControl(): TWinControl | null {
    return this.FActiveControl;
  }
  set ActiveControl(v: TWinControl | null) {
    this.FActiveControl = v;
    this.FreeNotification(v);
    if (v && this.FVisible && !this.Designing && !this.Loading) v.SetFocus();
  }

  get ModalResult(): TModalResult {
    return this.FModalResult;
  }
  set ModalResult(v: TModalResult) {
    this.FModalResult = toInt(v);
    if (this.FFormState.has('fsModal') && this.FModalResult !== mrNone) this.Close();
  }

  get Modal(): boolean {
    return this.FFormState.has('fsModal');
  }

  get Active(): boolean {
    return this.FFormState.has('fsActive');
  }

  override Notification(AComponent: TComponent, Operation: TOperation): void {
    super.Notification(AComponent, Operation);
    if (Operation === 'opRemove' && AComponent === this.FActiveControl) this.FActiveControl = null;
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    this.FTitleBar = el('div', 'vcl-form-titlebar', e);
    const icon = el('span', 'vcl-form-icon', this.FTitleBar);
    icon.appendChild(svgIcon(['M2 3h12v10H2z', 'M2 6h12'], 14, 'vcl-svg vcl-stroke'));
    this.FCaptionEl = el('span', 'vcl-form-caption', this.FTitleBar);
    const btns = el('span', 'vcl-form-sysbuttons', this.FTitleBar);
    const mk = (cls: string, paths: string[], title: string, action: () => void) => {
      const b = el('span', `vcl-sysbtn ${cls}`, btns);
      b.title = title;
      b.appendChild(svgIcon(paths, 12, 'vcl-svg vcl-stroke'));
      b.addEventListener('mousedown', (ev) => ev.stopPropagation());
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!this.Designing) action();
      });
      return b;
    };
    mk('vcl-sysbtn-min', ['M3 8.5h10'], 'Simge durumuna küçült', () => (this.WindowState = this.FWindowState === 'wsMinimized' ? 'wsNormal' : 'wsMinimized'));
    mk('vcl-sysbtn-max', ['M3.5 3.5h9v9h-9z'], 'Ekranı kapla', () => (this.WindowState = this.FWindowState === 'wsMaximized' ? 'wsNormal' : 'wsMaximized'));
    mk('vcl-sysbtn-close', ['M4 4l8 8', 'M12 4l-8 8'], 'Kapat', () => this.Close());
    this.FClientEl = el('div', 'vcl-form-client', e);
    this.FSizeGrip = el('div', 'vcl-form-sizegrip', e);
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.CaptionChanged();
    this.UpdateFrame();
    this.AttachWindowBehaviour();
  }

  protected override CaptionChanged(): void {
    if (this.FCaptionEl) this.FCaptionEl.textContent = this.FCaption;
    if (HAS_DOM && !this.Designing && Application.MainForm === this && this.FVisible) document.title = this.FCaption;
  }

  /* Color applies to the client area; the frame keeps the window chrome colour. */
  protected override ColorElement(): HTMLElement | null {
    return this.FClientEl;
  }

  protected override UpdateColorStyle(): void {
    const e = this.FClientEl;
    if (e) e.style.backgroundColor = ColorToCSS(this.FColor);
    for (const c of this.FControls) if (c.ParentColor) c.ParentColor = true;
  }

  private UpdateFrame(): void {
    const e = this.FElement;
    if (!e) return;
    const f = this.FrameMetrics();
    e.dataset.border = this.FBorderStyle;
    e.style.setProperty('--vcl-title-h', `${f.title}px`);
    e.style.setProperty('--vcl-border-w', `${f.border}px`);
    const icons = this.FBorderIcons;
    const sys = icons.includes('biSystemMenu');
    const dialog = this.FBorderStyle === 'bsDialog' || this.FBorderStyle === 'bsToolWindow' || this.FBorderStyle === 'bsSizeToolWin';
    e.classList.toggle('vcl-no-min', !sys || dialog || !icons.includes('biMinimize'));
    e.classList.toggle('vcl-no-max', !sys || dialog || !icons.includes('biMaximize'));
    e.classList.toggle('vcl-no-close', !sys);
    e.classList.toggle('vcl-sizeable', this.FBorderStyle === 'bsSizeable' || this.FBorderStyle === 'bsSizeToolWin');
  }

  /* ------------------------------------------------------- lifecycle -- */

  /** Overridden by generated form classes: creates the designed components. */
  InitializeComponent(): void {
    /* designer generated code goes here */
  }

  override AfterConstruction(): void {
    super.AfterConstruction();
    this.AttachToDesktop();
    this.FFormState.add('fsCreating');
    this.BeginLoading();
    try {
      this.InitializeComponent();
    } finally {
      this.EndLoading();
      this.FFormState.delete('fsCreating');
    }
    this.Fire(this.OnCreate);
  }

  /** Binds a designer event (component.OnX → form method) at runtime. */
  BindEvent(AComponent: TComponent, EventName: string, HandlerName: string): void {
    if (this.Designing) return;
    const handler = (this as unknown as Record<string, unknown>)[HandlerName];
    if (typeof handler !== 'function') {
      console.warn(`[VCL] ${this.Name}.${HandlerName} olay işleyicisi bulunamadı (${AComponent.Name}.${EventName})`);
      return;
    }
    (AComponent as unknown as Record<string, unknown>)[EventName] = (handler as (...a: unknown[]) => unknown).bind(this);
  }

  /** Puts the (still hidden) window into the application desktop so it can measure text. */
  AttachToDesktop(): void {
    if (!HAS_DOM || this.Designing) return;
    const e = this.Element;
    if (!e.isConnected) {
      e.classList.add('vcl-offscreen');
      Application.Desktop.appendChild(e);
    }
  }

  protected override UpdateVisibleStyle(): void {
    const e = this.FElement;
    if (!e) return;
    if (this.Designing) {
      e.style.display = '';
      e.classList.remove('vcl-offscreen');
      return;
    }
    e.classList.toggle('vcl-offscreen', !this.FVisible);
  }

  protected override VisibleChanged(): void {
    if (this.Designing) return;
    if (this.FVisible) {
      this.AttachToDesktop();
      if (!this.FFormState.has('fsShown')) {
        this.FFormState.add('fsShown');
        this.PlaceWindow();
        if (this.FWindowState !== 'wsNormal') this.ApplyWindowState('wsNormal');
      }
      this.Activate();
      if (Application.MainForm === this && this.FCaption) document.title = this.FCaption;
      this.Fire(this.OnShow);
      queueMicrotask(() => this.FocusFirst());
    } else {
      this.Deactivate();
      this.Fire(this.OnHide);
    }
  }

  private FocusFirst(): void {
    if (!this.FVisible) return;
    if (this.FActiveControl?.CanFocus) {
      this.FActiveControl.SetFocus();
      return;
    }
    this.FindNextControl(null, true)?.SetFocus();
  }

  private PlaceWindow(): void {
    const desk = Application.Desktop.getBoundingClientRect();
    let x = this.FLeft, y = this.FTop;
    const center = (w: number, h: number, ox = 0, oy = 0) => {
      x = Math.round(ox + (w - this.FWidth) / 2);
      y = Math.round(oy + (h - this.FHeight) / 2);
    };
    const owner = this.Owner instanceof TCustomForm ? this.Owner : null;
    switch (this.FPosition) {
      case 'poScreenCenter':
      case 'poDefault':
        center(desk.width, desk.height);
        break;
      case 'poMainFormCenter':
      case 'poOwnerFormCenter': {
        const ref = (this.FPosition === 'poOwnerFormCenter' ? owner : Application.MainForm) ?? null;
        if (ref && ref !== this && ref.FVisible) center(ref.Width, ref.Height, ref.Left, ref.Top);
        else center(desk.width, desk.height);
        break;
      }
      default:
        break;
    }
    x = Math.max(0, Math.min(x, Math.max(0, desk.width - 80)));
    y = Math.max(0, Math.min(y, Math.max(0, desk.height - 40)));
    this.SetBounds(x, y, this.FWidth, this.FHeight);
  }

  private ApplyWindowState(old: TWindowState): void {
    const e = this.Element;
    if (old === 'wsNormal') this.FRestoreBounds = this.BoundsRect;
    e.classList.toggle('vcl-maximized', this.FWindowState === 'wsMaximized');
    e.classList.toggle('vcl-minimized', this.FWindowState === 'wsMinimized');
    if (this.FWindowState === 'wsMaximized') {
      const d = Application.Desktop.getBoundingClientRect();
      this.SetBounds(0, 0, Math.round(d.width), Math.round(d.height));
    } else if (this.FRestoreBounds) {
      const r = this.FRestoreBounds;
      if (this.FWindowState === 'wsNormal') {
        this.SetBounds(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);
        this.FRestoreBounds = null;
      }
    }
  }

  /** Brings the window to the front and makes it the active form. */
  Activate(): void {
    if (this.Designing || !this.FElement) return;
    this.FElement.style.zIndex = String(Application.NextZ());
    const prev = Screen.ActiveForm;
    if (prev === this) return;
    prev?.Deactivate();
    Screen.ActiveForm = this;
    this.FFormState.add('fsActive');
    this.FElement.classList.add('vcl-active');
    this.Fire(this.OnActivate);
  }

  Deactivate(): void {
    if (!this.FFormState.has('fsActive')) return;
    this.FFormState.delete('fsActive');
    this.FElement?.classList.remove('vcl-active');
    if (Screen.ActiveForm === this) Screen.ActiveForm = null;
    this.Fire(this.OnDeactivate);
  }

  CloseQuery(): boolean {
    const args: TCloseQueryEventArgs = { CanClose: true };
    this.Fire(this.OnCloseQuery, args);
    return args.CanClose;
  }

  /** Delphi Close: OnCloseQuery → OnClose(Action) → hide/free. Closing the main form ends the app. */
  Close(): void {
    if (this.Designing) return;
    if (!this.CloseQuery()) return;
    const isMain = Application.MainForm === this;
    const args: TCloseEventArgs = { Action: isMain ? 'caFree' : 'caHide' };
    this.Fire(this.OnClose, args);
    if (args.Action === 'caNone') return;
    if (this.FFormState.has('fsModal')) this.EndModal();
    switch (args.Action) {
      case 'caMinimize':
        this.WindowState = 'wsMinimized';
        return;
      case 'caFree':
        this.Hide();
        if (isMain) Application.Terminate();
        else this.Release();
        return;
      default:
        this.Hide();
        if (isMain) Application.Terminate();
    }
  }

  /** Shows the form modally. Resolves with ModalResult when the form closes. */
  ShowModal(): Promise<TModalResult> {
    if (this.Designing) return Promise.resolve(mrNone);
    if (this.FVisible) throw new EVclError('Görünür bir form modal olarak açılamaz');
    this.FModalResult = mrNone;
    this.FFormState.add('fsModal');
    const overlay = el('div', 'vcl-modal-overlay', Application.Desktop);
    overlay.style.zIndex = String(Application.NextZ());
    overlay.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      this.FElement?.classList.add('vcl-flash');
      setTimeout(() => this.FElement?.classList.remove('vcl-flash'), 300);
    });
    this.FModalOverlay = overlay;
    return new Promise<TModalResult>((resolve) => {
      this.FModalResolve = resolve;
      this.Show();
    });
  }

  private EndModal(): void {
    this.FFormState.delete('fsModal');
    this.FModalOverlay?.remove();
    this.FModalOverlay = null;
    const resolve = this.FModalResolve;
    this.FModalResolve = null;
    if (this.FModalResult === mrNone) this.FModalResult = mrCancel;
    resolve?.(this.FModalResult);
  }

  /** Frees the form after the current event handler returns (Delphi Release). */
  Release(): void {
    setTimeout(() => this.Free(), 0);
  }

  override Destroy(): void {
    if (this.Destroying) return;
    this.Fire(this.OnDestroy);
    if (this.FFormState.has('fsModal')) this.EndModal();
    this.Deactivate();
    super.Destroy();
  }

  /* ------------------------------------------------------ keyboard/tab -- */

  /** Tab order traversal (depth-first by TabOrder), Delphi FindNextControl. */
  FindNextControl(CurControl: TWinControl | null, GoForward: boolean): TWinControl | null {
    const list: TWinControl[] = [];
    const collect = (p: TWinControl) => {
      const kids = p.Controls.filter((c): c is TWinControl => c instanceof TWinControl).sort((a, b) => a.TabOrder - b.TabOrder);
      for (const k of kids) {
        if (!k.Visible || !k.Enabled) continue;
        if (k.TabStop && !(k instanceof TCustomForm)) list.push(k);
        collect(k);
      }
    };
    collect(this);
    if (!list.length) return null;
    const i = CurControl ? list.indexOf(CurControl) : -1;
    if (i < 0) return GoForward ? list[0] : list[list.length - 1];
    return list[(i + (GoForward ? 1 : -1) + list.length) % list.length];
  }

  SelectNext(CurControl: TWinControl | null, GoForward = true): void {
    this.FindNextControl(CurControl, GoForward)?.SetFocus();
  }

  private FocusedControl(): TWinControl | null {
    const root = this.FElement?.getRootNode() as Document | ShadowRoot | undefined;
    let n = root?.activeElement ?? null;
    while (n && n !== this.FElement) {
      const c = ElementOwner.get(n);
      if (c instanceof TWinControl) return c;
      n = n.parentElement;
    }
    return null;
  }

  private AllControls(): TControl[] {
    const out: TControl[] = [];
    const walk = (p: TWinControl) => {
      for (const c of p.Controls) {
        out.push(c);
        if (c instanceof TWinControl) walk(c);
      }
    };
    walk(this);
    return out;
  }

  private AttachWindowBehaviour(): void {
    const e = this.FElement!;
    // Key preview (capture phase) + dialog keys (bubble phase)
    e.addEventListener(
      'keydown',
      (ev) => {
        if (this.Designing || !this.FKeyPreview || !this.OnKeyDown) return;
        const args: TKeyEventArgs = { Key: ev.key, KeyCode: ev.keyCode, Shift: shiftOf(ev), Handled: false, Event: ev };
        this.Fire(this.OnKeyDown, args);
        if (args.Handled || args.Key === '') {
          ev.preventDefault();
          ev.stopPropagation();
        }
      },
      true,
    );
    e.addEventListener('keydown', (ev) => {
      if (this.Designing || ev.defaultPrevented) return;
      const target = ev.target as HTMLElement;
      if (ev.key === 'Tab') {
        ev.preventDefault();
        this.SelectNext(this.FocusedControl(), !ev.shiftKey);
      } else if (ev.key === 'Enter' && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLButtonElement)) {
        const def = this.AllControls().find((c): c is TButton => c instanceof TButton && c.Default && c.Showing && c.Enabled);
        if (def) {
          ev.preventDefault();
          def.Click();
        }
      } else if (ev.key === 'Escape') {
        const cancel = this.AllControls().find((c): c is TButton => c instanceof TButton && c.Cancel && c.Showing && c.Enabled);
        if (cancel) {
          ev.preventDefault();
          cancel.Click();
        }
      } else if (ev.altKey && ev.key.length === 1) {
        const k = ev.key.toLowerCase();
        for (const c of this.AllControls()) {
          if (!c.Showing || !c.Enabled) continue;
          if (c instanceof TButton && c.Accelerator === k) {
            ev.preventDefault();
            c.SetFocus();
            c.Click();
            return;
          }
          if (c instanceof TLabel && c.Accelerator === k && c.FocusControl) {
            ev.preventDefault();
            c.FocusControl.SetFocus();
            return;
          }
        }
      }
    });
    e.addEventListener('mousedown', () => {
      if (!this.Designing && this.FVisible) this.Activate();
    }, true);
    // Title bar drag + maximise toggle
    const title = this.FTitleBar!;
    title.addEventListener('dblclick', () => {
      if (this.Designing || this.FBorderStyle === 'bsDialog' || !this.FBorderIcons.includes('biMaximize')) return;
      this.WindowState = this.FWindowState === 'wsMaximized' ? 'wsNormal' : 'wsMaximized';
    });
    title.addEventListener('pointerdown', (ev) => {
      if (this.Designing || ev.button !== 0 || this.FWindowState === 'wsMaximized') return;
      ev.preventDefault();
      const sx = ev.clientX, sy = ev.clientY, ox = this.FLeft, oy = this.FTop;
      title.setPointerCapture(ev.pointerId);
      const move = (m: PointerEvent) => this.SetBounds(ox + m.clientX - sx, Math.max(0, oy + m.clientY - sy), this.FWidth, this.FHeight);
      const up = () => {
        title.removeEventListener('pointermove', move);
        title.removeEventListener('pointerup', up);
      };
      title.addEventListener('pointermove', move);
      title.addEventListener('pointerup', up);
    });
    const grip = this.FSizeGrip!;
    grip.addEventListener('pointerdown', (ev) => {
      if (this.Designing || ev.button !== 0) return;
      ev.preventDefault();
      const sx = ev.clientX, sy = ev.clientY, ow = this.FWidth, oh = this.FHeight;
      grip.setPointerCapture(ev.pointerId);
      const move = (m: PointerEvent) => this.SetBounds(this.FLeft, this.FTop, Math.max(160, ow + m.clientX - sx), Math.max(80, oh + m.clientY - sy));
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  }
}

/** TForm — the class every designed form (Form1, Form2 …) derives from. */
export class TForm extends TCustomForm {}

/* ========================================================== application == */

export class TScreen extends TObject {
  ActiveForm: TCustomForm | null = null;
  private FCursor: TCursor = 'crDefault';

  get Width(): number {
    return HAS_DOM ? window.innerWidth : 0;
  }

  get Height(): number {
    return HAS_DOM ? window.innerHeight : 0;
  }

  get Forms(): TCustomForm[] {
    return Application.Forms;
  }

  get FormCount(): number {
    return Application.Forms.length;
  }

  get Cursor(): TCursor {
    return this.FCursor;
  }
  set Cursor(v: TCursor) {
    this.FCursor = v;
    if (HAS_DOM) document.documentElement.style.cursor = CURSORS[v] ?? '';
  }
}

export class TApplication extends TComponent {
  Title = '';
  OnException: ((Sender: unknown, E: Error) => void) | null = null;
  private FMainForm: TCustomForm | null = null;
  private FTerminated = false;
  private FInitialized = false;
  private FFormClasses = new Map<string, TFormClass>();
  private FDesktop: HTMLElement | null = null;
  private FZ = 10;
  private FShowingException = false;

  get MainForm(): TCustomForm | null {
    return this.FMainForm;
  }

  get Terminated(): boolean {
    return this.FTerminated;
  }

  /** Root element that hosts all runtime windows. */
  get Desktop(): HTMLElement {
    if (!this.FDesktop || !this.FDesktop.isConnected) {
      this.FDesktop = document.getElementById('vcl-desktop') ?? el('div', '', document.body);
      this.FDesktop.id = 'vcl-desktop';
      this.FDesktop.classList.add('vcl-desktop');
    }
    return this.FDesktop;
  }

  NextZ(): number {
    return ++this.FZ;
  }

  get Forms(): TCustomForm[] {
    return this.Components.filter((c): c is TCustomForm => c instanceof TCustomForm);
  }

  Initialize(): void {
    if (this.FInitialized) return;
    this.FInitialized = true;
    if (!HAS_DOM) return;
    IdeBridge.Install();
    document.documentElement.classList.add('vcl-app');
  }

  RegisterFormClass(AClass: TFormClass, ClassName?: string): void {
    const cn = ClassName ?? `T${(AClass as unknown as { name: string }).name}`;
    ClassNames.set(AClass, cn);
    this.FFormClasses.set(cn.toLowerCase(), AClass);
    this.FFormClasses.set(cn.replace(/^T/, '').toLowerCase(), AClass);
  }

  FindFormClass(Name: string): TFormClass | null {
    return this.FFormClasses.get(Name.toLowerCase()) ?? null;
  }

  FindFormInstance<T extends TCustomForm>(AClass: TFormClass<T>): T | null {
    return (this.Forms.find((f) => f.constructor === AClass) as T | undefined) ?? null;
  }

  FindForm(Name: string): TCustomForm | null {
    const lower = Name.toLowerCase();
    return this.Forms.find((f) => f.Name.toLowerCase() === lower || f.ClassName.toLowerCase() === lower) ?? null;
  }

  /** Delphi Application.CreateForm — the first form created becomes MainForm. */
  CreateForm<T extends TCustomForm>(AClass: TFormClass<T> | string): T {
    const cls = (typeof AClass === 'string' ? this.FindFormClass(AClass) : AClass) as TFormClass<T> | null;
    if (!cls) throw new EComponentError(`Form sınıfı bulunamadı: ${String(AClass)}`);
    const f = cls.Create(this);
    if (!this.FMainForm) this.FMainForm = f;
    return f;
  }

  /** Shows the main form (creating it first if needed). */
  Run(MainForm?: TFormClass | string): void {
    this.Initialize();
    if (!this.FMainForm && MainForm) this.CreateForm(MainForm);
    if (!this.FMainForm) throw new EVclError('Ana form yok: Application.CreateForm çağrılmadı');
    if (this.Title) document.title = this.Title;
    this.FMainForm.Show();
  }

  Terminate(): void {
    if (this.FTerminated) return;
    this.FTerminated = true;
    for (const f of this.Forms) {
      f.Hide();
    }
    setTimeout(() => {
      for (const f of this.Forms) f.Free();
      if (!HAS_DOM) return;
      const d = el('div', 'vcl-terminated', this.Desktop);
      el('div', 'vcl-terminated-title', d).textContent = 'Uygulama sonlandı';
      const b = el('button', 'vcl-terminated-restart', d);
      b.type = 'button';
      b.textContent = 'Yeniden başlat';
      b.addEventListener('click', () => location.reload());
      IdeBridge.Post({ type: 'terminated' });
    }, 0);
  }

  /** Default exception handler: OnException or an error dialog (Delphi behaviour). */
  HandleException(E: unknown, Sender?: unknown): void {
    const err = E instanceof Error ? E : new Error(String(E));
    if (this.OnException) {
      try {
        this.OnException.call(this, Sender ?? this, err);
        return;
      } catch (inner) {
        console.error(inner);
      }
    }
    this.ShowException(err);
  }

  ShowException(E: Error): void {
    console.error(E);
    if (!HAS_DOM || this.FShowingException) return;
    this.FShowingException = true;
    void MessageDlg(E.message || String(E), 'mtError', ['mbOK'], E.name || 'Hata').finally(() => (this.FShowingException = false));
  }

  /** Lets the browser render pending changes (Delphi ProcessMessages). */
  ProcessMessages(): Promise<void> {
    return new Promise((r) => setTimeout(r, 0));
  }

  MessageBox(Text: string, Caption = '', Buttons: TMsgDlgBtn[] = ['mbOK']): Promise<TModalResult> {
    return MessageDlg(Text, 'mtCustom', Buttons, Caption || this.Title);
  }
}

export const Application = new TApplication(null);
export const Screen = new TScreen();

/* ============================================================== dialogs == */

const DLG_BUTTONS: Record<TMsgDlgBtn, [string, TModalResult]> = {
  mbYes: ['Evet', mrYes], mbNo: ['Hayır', mrNo], mbOK: ['Tamam', mrOk], mbCancel: ['İptal', mrCancel],
  mbAbort: ['Durdur', mrAbort], mbRetry: ['Yeniden dene', mrRetry], mbIgnore: ['Yoksay', mrIgnore],
  mbAll: ['Tümü', mrAll], mbClose: ['Kapat', mrClose],
};

const DLG_TITLES: Record<TMsgDlgType, string> = {
  mtWarning: 'Uyarı', mtError: 'Hata', mtInformation: 'Bilgi', mtConfirmation: 'Onay', mtCustom: '',
};

const DLG_ICONS: Record<TMsgDlgType, string[]> = {
  mtWarning: ['M8 1.5l7 12.5H1z', 'M8 6v4', 'M8 11.8v.4'],
  mtError: ['M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z', 'M5.5 5.5l5 5', 'M10.5 5.5l-5 5'],
  mtInformation: ['M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z', 'M8 7v4.5', 'M8 4.6v.4'],
  mtConfirmation: ['M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z', 'M6 6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5', 'M8 11.6v.4'],
  mtCustom: [],
};

function dialogHost(): HTMLElement {
  return HAS_DOM ? Application.Desktop : (null as unknown as HTMLElement);
}

function openDialog(
  caption: string,
  build: (body: HTMLElement) => HTMLElement | null,
  buttons: Array<[string, TModalResult]>,
  onResult: (mr: TModalResult) => void,
  kind: TMsgDlgType = 'mtCustom',
): void {
  const overlay = el('div', 'vcl-modal-overlay vcl-dialog-overlay', dialogHost());
  overlay.style.zIndex = String(Application.NextZ());
  const win = el('div', `vcl-dialog vcl-dialog-${kind}`, overlay);
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  const title = el('div', 'vcl-dialog-title', win);
  title.textContent = caption || Application.Title || document.title || 'JS-Delphi';
  const body = el('div', 'vcl-dialog-body', win);
  if (DLG_ICONS[kind].length) body.appendChild(svgIcon(DLG_ICONS[kind], 32, `vcl-svg vcl-stroke vcl-dialog-icon vcl-icon-${kind}`));
  const focusTarget = build(el('div', 'vcl-dialog-content', body));
  const bar = el('div', 'vcl-dialog-buttons', win);
  const prevFocus = document.activeElement as HTMLElement | null;
  const close = (mr: TModalResult) => {
    overlay.remove();
    document.removeEventListener('keydown', keys, true);
    prevFocus?.focus?.();
    onResult(mr);
  };
  const btnEls = buttons.map(([label, mr], i) => {
    const b = el('button', `vcl-dialog-button${i === 0 ? ' vcl-default' : ''}`, bar);
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => close(mr));
    return b;
  });
  const cancelMr = buttons.find(([, mr]) => mr === mrCancel || mr === mrNo || mr === mrClose)?.[1] ?? (buttons.length === 1 ? buttons[0][1] : null);
  const keys = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && cancelMr !== null) {
      ev.preventDefault();
      ev.stopPropagation();
      close(cancelMr);
    } else if (ev.key === 'Enter' && !(ev.target instanceof HTMLButtonElement)) {
      ev.preventDefault();
      ev.stopPropagation();
      close(buttons[0][1]);
    }
  };
  document.addEventListener('keydown', keys, true);
  queueMicrotask(() => (focusTarget ?? btnEls[0])?.focus());
}

/** Delphi MessageDlg — resolves with the modal result of the pressed button. */
export function MessageDlg(Msg: string, DlgType: TMsgDlgType = 'mtInformation', Buttons: TMsgDlgBtn[] = ['mbOK'], Caption?: string): Promise<TModalResult> {
  if (!HAS_DOM) return Promise.resolve(mrOk);
  const btns = (Buttons.length ? Buttons : ['mbOK' as TMsgDlgBtn]).map((b) => DLG_BUTTONS[b]).filter(Boolean);
  return new Promise((resolve) => {
    openDialog(
      Caption ?? DLG_TITLES[DlgType],
      (body) => {
        const p = el('div', 'vcl-dialog-text', body);
        p.textContent = String(Msg);
        return null;
      },
      btns,
      resolve,
      DlgType,
    );
  });
}

/** Delphi ShowMessage (asynchronous: `await ShowMessage('…')`). */
export function ShowMessage(Msg: unknown): Promise<void> {
  return MessageDlg(typeof Msg === 'string' ? Msg : String(Msg), 'mtCustom', ['mbOK']).then(() => undefined);
}

/** Yes/No confirmation helper. */
export function Confirm(Msg: string, Caption?: string): Promise<boolean> {
  return MessageDlg(Msg, 'mtConfirmation', ['mbYes', 'mbNo'], Caption).then((mr) => mr === mrYes);
}

/** Delphi InputQuery — resolves with the entered text or null when cancelled. */
export function InputQuery(ACaption: string, APrompt: string, ADefault = ''): Promise<string | null> {
  if (!HAS_DOM) return Promise.resolve(null);
  return new Promise((resolve) => {
    let input: HTMLInputElement;
    openDialog(
      ACaption,
      (body) => {
        const p = el('label', 'vcl-dialog-text', body);
        p.textContent = APrompt;
        input = el('input', 'vcl-dialog-input', body);
        input.type = 'text';
        input.value = ADefault;
        queueMicrotask(() => input.select());
        return input;
      },
      [DLG_BUTTONS.mbOK, DLG_BUTTONS.mbCancel],
      (mr) => resolve(mr === mrOk ? input.value : null),
      'mtCustom',
    );
  });
}

/** Delphi InputBox — resolves with ADefault when cancelled. */
export function InputBox(ACaption: string, APrompt: string, ADefault = ''): Promise<string> {
  return InputQuery(ACaption, APrompt, ADefault).then((v) => (v === null ? ADefault : v));
}

/* ==================================================== RTL helper functions == */

export function IntToStr(Value: number): string {
  return String(Math.trunc(Value));
}

export function StrToInt(S: string): number {
  const t = String(S).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new EConvertError(`'${S}' geçerli bir tam sayı değil`);
  return parseInt(t, 10);
}

export function StrToIntDef(S: string, Default: number): number {
  try {
    return StrToInt(S);
  } catch {
    return Default;
  }
}

export function FloatToStr(Value: number): string {
  return String(Value).replace('.', ',');
}

export function StrToFloat(S: string): number {
  const t = String(S).trim().replace(/\./g, '').replace(',', '.');
  const v = Number(t);
  if (!t || !Number.isFinite(v)) throw new EConvertError(`'${S}' geçerli bir sayı değil`);
  return v;
}

export function StrToFloatDef(S: string, Default: number): number {
  try {
    return StrToFloat(S);
  } catch {
    return Default;
  }
}

/** FormatFloat('#,##0.00', 1234.5) → "1.234,50" (Turkish separators). */
export function FormatFloat(Format: string, Value: number): string {
  const dot = Format.indexOf('.');
  const decimals = dot >= 0 ? Format.length - dot - 1 : 0;
  const grouping = Format.includes(',');
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping }).format(Value);
}

/** FormatDateTime('dd.mm.yyyy hh:nn:ss', Now()). */
export function FormatDateTime(Format: string, D: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return Format.replace(/yyyy|yy|mm|dd|hh|nn|ss|zzz/g, (tok) => {
    switch (tok) {
      case 'yyyy': return String(D.getFullYear());
      case 'yy': return pad(D.getFullYear() % 100);
      case 'mm': return pad(D.getMonth() + 1);
      case 'dd': return pad(D.getDate());
      case 'hh': return pad(D.getHours());
      case 'nn': return pad(D.getMinutes());
      case 'ss': return pad(D.getSeconds());
      default: return pad(D.getMilliseconds(), 3);
    }
  });
}

export function Now(): Date {
  return new Date();
}

export function Trim(S: string): string {
  return String(S).trim();
}

export function UpperCase(S: string): string {
  return String(S).toLocaleUpperCase('tr');
}

export function LowerCase(S: string): string {
  return String(S).toLocaleLowerCase('tr');
}

export function QuotedStr(S: string): string {
  return `'${String(S).replace(/'/g, "''")}'`;
}

/** Format('%s: %d adet (%.2f)', ['Elma', 3, 1.5]) — %s %d %f %.Nf %% */
export function Format(Fmt: string, Args: unknown[]): string {
  let i = 0;
  return Fmt.replace(/%(%|s|d|(?:\.(\d+))?f)/g, (_m, kind: string, prec?: string) => {
    if (kind === '%') return '%';
    const a = Args[i++];
    if (kind === 's') return String(a ?? '');
    if (kind === 'd') return String(Math.trunc(Number(a)));
    return Number(a).toFixed(prec ? Number(prec) : 2);
  });
}

export function Sleep(Milliseconds: number): Promise<void> {
  return new Promise((r) => setTimeout(r, Math.max(0, Milliseconds)));
}

/* ================================================= IDE ↔ runtime bridge == */

type TBridgeMessage = Record<string, unknown> & { type: string };

function safeSerialize(v: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (v === null || v === undefined || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.length > 4000 ? `${v.slice(0, 4000)}…` : v;
  if (typeof v === 'bigint') return `${v}n`;
  if (typeof v === 'function') return `ƒ ${(v as { name?: string }).name || 'anonymous'}()`;
  if (typeof v === 'symbol') return v.toString();
  if (v instanceof Error) return { $error: v.name, message: v.message, stack: v.stack };
  if (v instanceof TComponent) return `<${v.ClassName}${v.Name ? ` ${v.Name}` : ''}>`;
  if (HAS_DOM && v instanceof Node) return `<${v.nodeName.toLowerCase()}>`;
  if (typeof v !== 'object') return String(v);
  if (seen.has(v as object)) return '[döngüsel]';
  if (depth > 4) return Array.isArray(v) ? `[Array(${v.length})]` : '[Object]';
  seen.add(v as object);
  if (Array.isArray(v)) return v.slice(0, 100).map((x) => safeSerialize(x, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as object).slice(0, 50)) out[k] = safeSerialize((v as Record<string, unknown>)[k], depth + 1, seen);
  return out;
}

/**
 * postMessage bridge between a running app (inside the IDE's sandboxed preview iframe)
 * and the IDE: console output and runtime errors go to the Messages panel, the IDE can
 * hand over configuration and ask for a reload.
 */
export const IdeBridge = {
  Installed: false,

  get Enabled(): boolean {
    return HAS_DOM && window.parent !== window;
  },

  Post(msg: TBridgeMessage): void {
    if (!this.Enabled) return;
    try {
      window.parent.postMessage({ __jsd: 1, ...msg }, '*');
    } catch {
      /* ignore */
    }
  },

  Install(): void {
    if (this.Installed || !this.Enabled) return;
    this.Installed = true;
    const levels = ['log', 'info', 'warn', 'error', 'debug'] as const;
    for (const level of levels) {
      const original = console[level].bind(console);
      console[level] = (...args: unknown[]) => {
        original(...args);
        this.Post({ type: 'console', level, args: args.map((a) => safeSerialize(a)) });
      };
    }
    window.addEventListener('error', (ev) => {
      this.Post({ type: 'error', message: ev.message, file: ev.filename, line: ev.lineno, col: ev.colno, stack: ev.error?.stack ?? '' });
    });
    window.addEventListener('unhandledrejection', (ev) => {
      const r = ev.reason;
      this.Post({ type: 'error', message: r instanceof Error ? r.message : String(r), stack: r instanceof Error ? r.stack ?? '' : '' });
    });
    window.addEventListener('message', (ev) => {
      if (ev.source !== window.parent) return;
      const d = ev.data as TBridgeMessage | null;
      if (!d || d.__jsd !== 1) return;
      if (d.type === 'init' && typeof d.token === 'string') DataService.Configure({ token: d.token });
      else if (d.type === 'reload') location.reload();
      else if (d.type === 'ping') this.Post({ type: 'pong' });
    });
    this.Post({ type: 'ready', path: location.pathname.replace(/^\/preview\/[^/]+\/[^/]+/, ''), vcl: VCL_VERSION });
  },
};

/* ============================================================ data access == */

/** Named SQL parameters (":name"), skipping string literals, comments and "::" casts. */
export function ExtractParamNames(SQL: string): string[] {
  const out: string[] = [];
  const s = String(SQL ?? '');
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      i++;
      while (i < s.length) {
        if (s[i] === q) {
          if (s[i + 1] === q) i += 2;
          else break;
        } else i++;
      }
      i++;
    } else if (ch === '-' && s[i + 1] === '-') {
      while (i < s.length && s[i] !== '\n') i++;
    } else if (ch === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      i = end < 0 ? s.length : end + 2;
    } else if (ch === ':' && s[i + 1] === ':') {
      i += 2;
    } else if (ch === ':' && /[A-Za-z_]/.test(s[i + 1] ?? '') && !/[A-Za-z0-9_]/.test(s[i - 1] ?? '')) {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      const name = s.slice(i + 1, j);
      if (!out.includes(name)) out.push(name);
      i = j;
    } else i++;
  }
  return out;
}

export interface TFieldDefJSON {
  name: string;
  type?: string;
  field_type?: TFieldType;
  nullable?: boolean;
  primary_key?: boolean;
  autoincrement?: boolean;
  size?: number;
}

export interface TQueryResultJSON {
  columns: TFieldDefJSON[];
  rows: unknown[][];
  row_count?: number;
  truncated?: boolean;
  rows_affected?: number;
  last_insert_id?: unknown;
  primary_key?: string[];
  inserted_primary_key?: Record<string, unknown>;
  elapsed_ms?: number;
}

export interface TDataServiceConfig {
  apiBase: string;
  token: string | null;
  /** Optional custom transport (the IDE designer injects its authenticated API client). */
  transport: ((path: string, body: unknown) => Promise<unknown>) | null;
}

/**
 * DataService — the only way generated code talks to databases: every TQuery/TTable/
 * TStoredProc request is a JSON POST to the backend proxy (/api/db/{connection}/…),
 * parameters are always sent separately from the SQL text and bound server side.
 */
export class DataService {
  private static FConfig: TDataServiceConfig = DataService.DetectDefaults();
  private static FConnections = new Map<string, string>();
  private static FTokenWaiters: Array<() => void> = [];

  static DetectDefaults(): TDataServiceConfig {
    if (!HAS_DOM) return { apiBase: '/api', token: null, transport: null };
    const m = /^\/preview\/[^/]+\/([^/]+)\//.exec(location.pathname);
    return { apiBase: '/api', token: m ? decodeURIComponent(m[1]) : null, transport: null };
  }

  static get Config(): Readonly<TDataServiceConfig> {
    return this.FConfig;
  }

  static Configure(cfg: Partial<TDataServiceConfig>): void {
    this.FConfig = { ...this.FConfig, ...cfg };
    if (this.FConfig.token || this.FConfig.transport) {
      const w = this.FTokenWaiters;
      this.FTokenWaiters = [];
      w.forEach((f) => f());
    }
  }

  /** Maps ConnectionDefName → backend connection id (emitted by the BuildService). */
  static RegisterConnections(Map: Record<string, string>): void {
    for (const [name, id] of Object.entries(Map ?? {})) this.FConnections.set(name.toLowerCase(), id);
  }

  static ResolveConnection(Name: string): string {
    const id = this.FConnections.get(String(Name ?? '').toLowerCase());
    if (!id) throw new EDatabaseError(`Bağlantı tanımı bulunamadı: '${Name}'`);
    return id;
  }

  static HasConnection(Name: string): boolean {
    return this.FConnections.has(String(Name ?? '').toLowerCase());
  }

  static async Request<T = unknown>(Path: string, Body: unknown): Promise<T> {
    const cfg = this.FConfig;
    if (cfg.transport) return (await cfg.transport(Path, Body)) as T;
    if (!HAS_DOM) throw new EDatabaseError('DataService tarayıcı dışında kullanılamaz');
    if (!cfg.token && window.parent !== window) {
      // Inside the IDE preview the token may arrive a moment later via the bridge.
      await new Promise<void>((resolve) => {
        this.FTokenWaiters.push(resolve);
        setTimeout(resolve, 1500);
      });
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.FConfig.token) headers.Authorization = `Bearer ${this.FConfig.token}`;
    const res = await fetch(`${cfg.apiBase}${Path}`, { method: 'POST', headers, body: JSON.stringify(Body), credentials: 'omit' });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* non JSON */
    }
    if (!res.ok) {
      const detail = (data as { detail?: unknown } | null)?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d) => (d as { msg?: string }).msg ?? '').join('; ') : `HTTP ${res.status}`;
      throw new EDatabaseError(msg);
    }
    return data as T;
  }

  static Query(ConnectionId: string, SQL: string, Params: Record<string, unknown> = {}, Options: { max_rows?: number; offset?: number; mode?: 'query' | 'exec' } = {}): Promise<TQueryResultJSON> {
    return this.Request<TQueryResultJSON>(`/db/${encodeURIComponent(ConnectionId)}/query`, { sql: SQL, params: Params, mode: Options.mode ?? 'query', max_rows: Options.max_rows, offset: Options.offset ?? 0 });
  }

  static Table(ConnectionId: string, Request: Record<string, unknown>): Promise<TQueryResultJSON> {
    return this.Request<TQueryResultJSON>(`/db/${encodeURIComponent(ConnectionId)}/table`, Request);
  }

  static Proc(ConnectionId: string, Name: string, Params: Record<string, unknown>): Promise<TQueryResultJSON> {
    return this.Request<TQueryResultJSON>(`/db/${encodeURIComponent(ConnectionId)}/proc`, { name: Name, params: Params });
  }
}

/* -------------------------------------------------------------- params -- */

export interface TParamJSON {
  Name: string;
  DataType?: TFieldType;
  Value?: unknown;
  ParamType?: TParamType;
}

function convertValue(v: unknown, t: TFieldType): unknown {
  if (v === null || v === undefined || v === '') return v === '' && (t === 'ftString' || t === 'ftMemo' || t === 'ftUnknown') ? '' : null;
  switch (t) {
    case 'ftInteger': {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new EConvertError(`'${String(v)}' tam sayıya dönüştürülemedi`);
      return Math.trunc(n);
    }
    case 'ftFloat':
    case 'ftCurrency': {
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n)) throw new EConvertError(`'${String(v)}' sayıya dönüştürülemedi`);
      return n;
    }
    case 'ftBoolean':
      return v === true || v === 1 || v === 'true' || v === '1' || v === 'True';
    case 'ftDate':
      return v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    case 'ftDateTime':
    case 'ftTime':
      return v instanceof Date ? v.toISOString() : String(v);
    case 'ftString':
    case 'ftMemo':
      return String(v);
    default:
      return typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v instanceof Date ? v.toISOString() : v;
  }
}

export class TParam extends TPersistent {
  Name = '';
  DataType: TFieldType = 'ftUnknown';
  ParamType: TParamType = 'ptInput';
  private FValue: unknown = null;

  get Value(): unknown {
    return this.FValue;
  }
  set Value(v: unknown) {
    this.FValue = v === undefined ? null : v;
  }

  get IsNull(): boolean {
    return this.FValue === null;
  }

  get AsString(): string {
    return this.FValue === null ? '' : String(this.FValue);
  }
  set AsString(v: string) {
    this.DataType = this.DataType === 'ftUnknown' ? 'ftString' : this.DataType;
    this.FValue = v;
  }

  get AsInteger(): number {
    return Math.trunc(Number(this.FValue) || 0);
  }
  set AsInteger(v: number) {
    this.DataType = 'ftInteger';
    this.FValue = Math.trunc(v);
  }

  get AsFloat(): number {
    return Number(this.FValue) || 0;
  }
  set AsFloat(v: number) {
    this.DataType = 'ftFloat';
    this.FValue = v;
  }

  get AsBoolean(): boolean {
    return !!convertValue(this.FValue, 'ftBoolean');
  }
  set AsBoolean(v: boolean) {
    this.DataType = 'ftBoolean';
    this.FValue = !!v;
  }

  get AsDateTime(): Date | null {
    return this.FValue === null ? null : new Date(String(this.FValue));
  }
  set AsDateTime(v: Date | null) {
    this.DataType = 'ftDateTime';
    this.FValue = v;
  }

  Clear(): void {
    this.FValue = null;
  }

  /** Value converted according to DataType, ready to be JSON encoded. */
  BoundValue(): unknown {
    return convertValue(this.FValue, this.DataType);
  }

  toJSON(): TParamJSON {
    const j: TParamJSON = { Name: this.Name, DataType: this.DataType };
    if (this.FValue !== null && this.FValue !== undefined) j.Value = this.FValue instanceof Date ? this.FValue.toISOString() : this.FValue;
    if (this.ParamType !== 'ptInput') j.ParamType = this.ParamType;
    return j;
  }
}

export class TParams extends TPersistent {
  private FItems: TParam[] = [];

  get Count(): number {
    return this.FItems.length;
  }

  get Items(): readonly TParam[] {
    return this.FItems.slice();
  }

  FindParam(Name: string): TParam | null {
    const lower = Name.toLowerCase();
    return this.FItems.find((p) => p.Name.toLowerCase() === lower) ?? null;
  }

  ParamByName(Name: string): TParam {
    const p = this.FindParam(Name);
    if (!p) throw new EDatabaseError(`Parametre bulunamadı: '${Name}'`);
    return p;
  }

  CreateParam(Name: string, DataType: TFieldType = 'ftUnknown'): TParam {
    const p = new TParam();
    p.Name = Name;
    p.DataType = DataType;
    this.FItems.push(p);
    return p;
  }

  Clear(): void {
    this.FItems = [];
  }

  /** Re-creates the list from the SQL text, keeping types/values of surviving params. */
  ParseSQL(SQL: string): void {
    const old = new Map(this.FItems.map((p) => [p.Name.toLowerCase(), p]));
    this.FItems = ExtractParamNames(SQL).map((n) => old.get(n.toLowerCase()) ?? Object.assign(new TParam(), { Name: n }));
  }

  ToValues(): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    for (const p of this.FItems) o[p.Name] = p.BoundValue();
    return o;
  }

  toJSON(): TParamJSON[] {
    return this.FItems.map((p) => p.toJSON());
  }

  FromJSON(v: unknown): void {
    this.FItems = (Array.isArray(v) ? v : []).filter((x) => x && typeof (x as TParamJSON).Name === 'string').map((x) => {
      const j = x as TParamJSON;
      const p = new TParam();
      p.Name = j.Name;
      p.DataType = j.DataType ?? 'ftUnknown';
      p.ParamType = j.ParamType ?? 'ptInput';
      p.Value = j.Value ?? null;
      return p;
    });
  }

  override Assign(Source: TPersistent | null): void {
    if (Source instanceof TParams) this.FromJSON(Source.toJSON());
    else super.Assign(Source);
  }

  [Symbol.iterator](): Iterator<TParam> {
    return this.FItems.slice()[Symbol.iterator]();
  }
}

/* -------------------------------------------------------------- fields -- */

export class TField extends TObject {
  FieldName = '';
  DataType: TFieldType = 'ftUnknown';
  SqlType = '';
  Size = 0;
  Required = false;
  ReadOnly = false;
  IsPrimaryKey = false;
  AutoIncrement = false;
  DisplayLabel = '';
  DisplayWidth = 0;
  Visible = true;
  Index = 0;
  private FDataSet: TDataSet;

  constructor(ADataSet: TDataSet) {
    super();
    this.FDataSet = ADataSet;
  }

  get DataSet(): TDataSet {
    return this.FDataSet;
  }

  get DisplayName(): string {
    return this.DisplayLabel || this.FieldName;
  }

  get Alignment(): TAlignment {
    return ['ftInteger', 'ftFloat', 'ftCurrency'].includes(this.DataType) ? 'taRightJustify' : 'taLeftJustify';
  }

  get Value(): unknown {
    return this.FDataSet.GetFieldValue(this.FieldName);
  }
  set Value(v: unknown) {
    this.FDataSet.SetFieldValue(this.FieldName, v);
  }

  get IsNull(): boolean {
    const v = this.Value;
    return v === null || v === undefined;
  }

  get AsString(): string {
    const v = this.Value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    return String(v);
  }
  set AsString(v: string) {
    this.Value = convertValue(v, this.DataType === 'ftUnknown' ? 'ftString' : this.DataType);
  }

  get AsInteger(): number {
    return Math.trunc(Number(this.Value) || 0);
  }
  set AsInteger(v: number) {
    this.Value = Math.trunc(v);
  }

  get AsFloat(): number {
    return Number(this.Value) || 0;
  }
  set AsFloat(v: number) {
    this.Value = v;
  }

  get AsBoolean(): boolean {
    return !!convertValue(this.Value, 'ftBoolean');
  }
  set AsBoolean(v: boolean) {
    this.Value = !!v;
  }

  get AsDateTime(): Date | null {
    const v = this.Value;
    return v === null || v === undefined || v === '' ? null : new Date(String(v));
  }
  set AsDateTime(v: Date | null) {
    this.Value = v ? (this.DataType === 'ftDate' ? v.toISOString().slice(0, 10) : v.toISOString()) : null;
  }

  /** Text for grids/edits (Turkish number and date formatting). */
  get DisplayText(): string {
    const v = this.Value;
    if (v === null || v === undefined) return '';
    switch (this.DataType) {
      case 'ftCurrency':
        return FormatFloat('#,##0.00', Number(v));
      case 'ftFloat':
        return typeof v === 'number' ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(v) : String(v);
      case 'ftBoolean':
        return v ? '✓' : '✗';
      case 'ftDate': {
        const d = new Date(String(v));
        return Number.isNaN(d.getTime()) ? String(v) : FormatDateTime('dd.mm.yyyy', d);
      }
      case 'ftDateTime': {
        const d = new Date(String(v));
        return Number.isNaN(d.getTime()) ? String(v) : FormatDateTime('dd.mm.yyyy hh:nn', d);
      }
      default:
        return String(v);
    }
  }

  Clear(): void {
    this.Value = null;
  }
}

export class TFields extends TObject {
  private FItems: TField[] = [];

  get Count(): number {
    return this.FItems.length;
  }

  get Items(): readonly TField[] {
    return this.FItems.slice();
  }

  Get(Index: number): TField {
    const f = this.FItems[Index];
    if (!f) throw new EListError(`Alan indeksi sınır dışında (${Index})`);
    return f;
  }

  FindField(Name: string): TField | null {
    const lower = String(Name).toLowerCase();
    return this.FItems.find((f) => f.FieldName.toLowerCase() === lower) ?? null;
  }

  FieldByName(Name: string): TField {
    const f = this.FindField(Name);
    if (!f) throw new EDatabaseError(`Alan bulunamadı: '${Name}'`);
    return f;
  }

  IndexOf(F: TField): number {
    return this.FItems.indexOf(F);
  }

  SetItems(Items: TField[]): void {
    this.FItems = Items;
    Items.forEach((f, i) => (f.Index = i));
  }

  [Symbol.iterator](): Iterator<TField> {
    return this.FItems.slice()[Symbol.iterator]();
  }
}

/* ---------------------------------------------------- connection/links -- */

/** TConnection — refers to a backend connection definition by name (secrets never leave the server). */
export class TConnection extends TComponent {
  protected FConnectionDefName = '';
  protected FConnected = false;
  protected FStreamedConnected = false;
  protected FLoginPrompt = false;
  private FDataSets = new Set<TDataSet>();
  BeforeConnect: TNotifyEvent | null = null;
  AfterConnect: TNotifyEvent | null = null;
  AfterDisconnect: TNotifyEvent | null = null;

  get ConnectionDefName(): string {
    return this.FConnectionDefName;
  }
  set ConnectionDefName(v: string) {
    v = String(v ?? '');
    if (v === this.FConnectionDefName) return;
    if (this.FConnected) this.Connected = false;
    this.FConnectionDefName = v;
  }

  /** Backend connection id resolved from ConnectionDefName. */
  get ConnectionId(): string {
    return DataService.ResolveConnection(this.FConnectionDefName);
  }

  get Connected(): boolean {
    return this.FConnected;
  }
  set Connected(v: boolean) {
    v = !!v;
    if (this.Loading) {
      this.FStreamedConnected = v;
      return;
    }
    if (v === this.FConnected) return;
    if (v) {
      this.Fire(this.BeforeConnect);
      void this.ConnectionId; // throws when the definition is unknown
      this.FConnected = true;
      this.Fire(this.AfterConnect);
    } else {
      for (const ds of this.FDataSets) ds.Close();
      this.FConnected = false;
      this.Fire(this.AfterDisconnect);
    }
  }

  get LoginPrompt(): boolean {
    return this.FLoginPrompt;
  }
  set LoginPrompt(v: boolean) {
    this.FLoginPrompt = !!v;
  }

  get DataSets(): readonly TDataSet[] {
    return [...this.FDataSets];
  }

  Open(): void {
    this.Connected = true;
  }

  Close(): void {
    this.Connected = false;
  }

  /** One-off parameterised SELECT → array of row objects. */
  async Query(SQL: string, Params: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
    this.Connected = true;
    const r = await DataService.Query(this.ConnectionId, SQL, Params);
    return r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c.name, row[i]])));
  }

  /** One-off parameterised INSERT/UPDATE/DELETE → rows affected. */
  async ExecSQL(SQL: string, Params: Record<string, unknown> = {}): Promise<number> {
    this.Connected = true;
    const r = await DataService.Query(this.ConnectionId, SQL, Params, { mode: 'exec' });
    return r.rows_affected ?? 0;
  }

  RegisterDataSet(ds: TDataSet): void {
    this.FDataSets.add(ds);
  }

  UnregisterDataSet(ds: TDataSet): void {
    this.FDataSets.delete(ds);
  }

  protected override Loaded(): void {
    super.Loaded();
    if (this.FStreamedConnected) {
      try {
        this.Connected = true;
      } catch (e) {
        if (!this.Designing) Application.HandleException(e, this);
      }
    }
  }
}

export type TDataEvent = 'deActiveChanged' | 'deDataSetChange' | 'deRecordChange' | 'deDataSetScroll' | 'deUpdateState' | 'deFieldChange' | 'deLayoutChange';

/** Connects a data-aware control to a TDataSource. */
export class TDataLink {
  private FDataSource: TDataSource | null = null;
  OnEvent: (Event: TDataEvent, Info?: unknown) => void;

  constructor(OnEvent: (Event: TDataEvent, Info?: unknown) => void) {
    this.OnEvent = OnEvent;
  }

  get DataSource(): TDataSource | null {
    return this.FDataSource;
  }
  set DataSource(v: TDataSource | null) {
    if (v === this.FDataSource) return;
    this.FDataSource?.RemoveLink(this);
    this.FDataSource = v;
    v?.AddLink(this);
    this.OnEvent('deLayoutChange');
  }

  get DataSet(): TDataSet | null {
    return this.FDataSource?.DataSet ?? null;
  }

  get Active(): boolean {
    return !!this.DataSet?.Active;
  }

  get Editing(): boolean {
    const s = this.DataSet?.State;
    return s === 'dsEdit' || s === 'dsInsert';
  }

  DataEvent(Event: TDataEvent, Info?: unknown): void {
    this.OnEvent(Event, Info);
  }
}

export class TDataSource extends TComponent {
  protected FDataSet: TDataSet | null = null;
  protected FEnabled = true;
  protected FAutoEdit = true;
  private FLinks = new Set<TDataLink>();
  OnDataChange: TEventHandler<{ Field: TField | null }> | null = null;
  OnStateChange: TNotifyEvent | null = null;

  get DataSet(): TDataSet | null {
    return this.FDataSet;
  }
  set DataSet(v: TDataSet | null) {
    if (v === this.FDataSet) return;
    this.FDataSet?.UnregisterDataSource(this);
    this.RemoveFreeNotification(this.FDataSet);
    this.FDataSet = v;
    if (v) {
      v.RegisterDataSource(this);
      this.FreeNotification(v);
    }
    this.DataEvent('deLayoutChange');
  }

  get Enabled(): boolean {
    return this.FEnabled;
  }
  set Enabled(v: boolean) {
    this.FEnabled = !!v;
    this.DataEvent('deLayoutChange');
  }

  get AutoEdit(): boolean {
    return this.FAutoEdit;
  }
  set AutoEdit(v: boolean) {
    this.FAutoEdit = !!v;
  }

  get State(): TDataSetState {
    return this.FDataSet?.State ?? 'dsInactive';
  }

  /** Puts the dataset into edit mode when AutoEdit allows it. */
  Edit(): boolean {
    const ds = this.FDataSet;
    if (!ds || !ds.Active) return false;
    if (ds.State === 'dsEdit' || ds.State === 'dsInsert') return true;
    if (!this.FAutoEdit || !ds.CanModify || ds.IsEmpty) return false;
    ds.Edit();
    return true;
  }

  AddLink(L: TDataLink): void {
    this.FLinks.add(L);
  }

  RemoveLink(L: TDataLink): void {
    this.FLinks.delete(L);
  }

  DataEvent(Event: TDataEvent, Info?: unknown): void {
    if (!this.FEnabled && Event !== 'deLayoutChange') return;
    for (const l of [...this.FLinks]) l.DataEvent(Event, Info);
    if (Event === 'deUpdateState') this.Fire(this.OnStateChange);
    else if (Event === 'deDataSetChange' || Event === 'deRecordChange' || Event === 'deDataSetScroll' || Event === 'deFieldChange') {
      this.Fire(this.OnDataChange, { Field: Event === 'deFieldChange' ? ((Info as TField | undefined) ?? null) : null });
    }
  }

  override Notification(AComponent: TComponent, Operation: TOperation): void {
    super.Notification(AComponent, Operation);
    if (Operation === 'opRemove' && AComponent === this.FDataSet) this.DataSet = null;
  }
}

/* -------------------------------------------------------------- dataset -- */

type TRecord = Record<string, unknown>;

/**
 * TDataSet — client-side record buffer with a Delphi state machine
 * (dsInactive → dsBrowse ⇄ dsEdit/dsInsert). Posting is optimistic: the local buffer
 * changes immediately and is rolled back if the backend rejects the change.
 */
export abstract class TDataSet extends TComponent {
  protected FActive = false;
  protected FStreamedActive = false;
  protected FOpening: Promise<void> | null = null;
  protected FState: TDataSetState = 'dsInactive';
  protected FFields = new TFields();
  protected FRecords: TRecord[] = [];
  protected FIndex = -1;
  protected FBof = true;
  protected FEof = true;
  protected FEditBuffer: TRecord | null = null;
  protected FOldValues: TRecord | null = null;
  protected FModified = false;
  protected FDisableCount = 0;
  protected FPendingEvent = false;
  protected FDataSources = new Set<TDataSource>();
  protected FConnection: TConnection | null = null;
  protected FMaxRows = 500;
  protected FTruncated = false;
  protected FPrimaryKey: string[] = [];

  BeforeOpen: TNotifyEvent | null = null;
  AfterOpen: TNotifyEvent | null = null;
  BeforeClose: TNotifyEvent | null = null;
  AfterClose: TNotifyEvent | null = null;
  BeforeInsert: TNotifyEvent | null = null;
  AfterInsert: TNotifyEvent | null = null;
  BeforeEdit: TNotifyEvent | null = null;
  AfterEdit: TNotifyEvent | null = null;
  BeforePost: TNotifyEvent | null = null;
  AfterPost: TNotifyEvent | null = null;
  BeforeCancel: TNotifyEvent | null = null;
  AfterCancel: TNotifyEvent | null = null;
  BeforeDelete: TNotifyEvent | null = null;
  AfterDelete: TNotifyEvent | null = null;
  BeforeScroll: TNotifyEvent | null = null;
  AfterScroll: TNotifyEvent | null = null;
  OnNewRecord: TNotifyEvent | null = null;
  OnPostError: TEventHandler<{ Error: Error }> | null = null;

  /* ------------------------------------------------------- properties -- */

  get Connection(): TConnection | null {
    return this.FConnection;
  }
  set Connection(v: TConnection | null) {
    if (v === this.FConnection) return;
    if (this.FActive) this.Close();
    this.FConnection?.UnregisterDataSet(this);
    this.RemoveFreeNotification(this.FConnection);
    this.FConnection = v;
    if (v) {
      v.RegisterDataSet(this);
      this.FreeNotification(v);
    }
  }

  get Active(): boolean {
    return this.FActive;
  }
  set Active(v: boolean) {
    v = !!v;
    if (this.Loading) {
      this.FStreamedActive = v;
      return;
    }
    if (v) void this.Open().catch((e) => Application.HandleException(e, this));
    else this.Close();
  }

  get MaxRows(): number {
    return this.FMaxRows;
  }
  set MaxRows(v: number) {
    this.FMaxRows = clamp(toInt(v, 500), 1, 5000);
  }

  get State(): TDataSetState {
    return this.FState;
  }

  get Fields(): TFields {
    return this.FFields;
  }

  get FieldCount(): number {
    return this.FFields.Count;
  }

  get RecordCount(): number {
    return this.FRecords.length;
  }

  /** 1-based current record number (0 when empty). */
  get RecNo(): number {
    return this.FIndex + 1;
  }
  set RecNo(v: number) {
    this.MoveTo(toInt(v) - 1);
  }

  get Bof(): boolean {
    return this.FBof;
  }

  get Eof(): boolean {
    return this.FEof;
  }

  get IsEmpty(): boolean {
    return this.FRecords.length === 0 && this.FState !== 'dsInsert';
  }

  get Modified(): boolean {
    return this.FModified;
  }

  /** True when the server stopped at MaxRows. */
  get Truncated(): boolean {
    return this.FTruncated;
  }

  get PrimaryKey(): readonly string[] {
    return this.FPrimaryKey.slice();
  }

  get CanModify(): boolean {
    return false;
  }

  get ControlsDisabled(): boolean {
    return this.FDisableCount > 0;
  }

  /** Snapshot of the current record (edit buffer while editing). */
  get CurrentRecord(): Readonly<TRecord> | null {
    if (this.FEditBuffer) return this.FEditBuffer;
    return this.FIndex >= 0 ? this.FRecords[this.FIndex] : null;
  }

  RecordAt(Index: number): Readonly<TRecord> | null {
    if (this.FState === 'dsInsert' && Index === this.FIndex) return this.FEditBuffer;
    return this.FRecords[Index] ?? null;
  }

  /* -------------------------------------------------------- open/close -- */

  async Open(): Promise<void> {
    if (this.FActive) return;
    if (this.FOpening) return this.FOpening;
    this.FOpening = (async () => {
      this.Fire(this.BeforeOpen);
      const data = await this.DoOpenData();
      this.SetData(data);
      this.FActive = true;
      this.FState = 'dsBrowse';
      this.FIndex = this.FRecords.length ? 0 : -1;
      this.FBof = true;
      this.FEof = this.FRecords.length === 0;
      this.DataEvent('deActiveChanged');
      this.DataEvent('deUpdateState');
      this.Fire(this.AfterOpen);
      this.Fire(this.AfterScroll);
    })();
    try {
      await this.FOpening;
    } finally {
      this.FOpening = null;
    }
  }

  Close(): void {
    if (!this.FActive) return;
    this.Fire(this.BeforeClose);
    this.FActive = false;
    this.FState = 'dsInactive';
    this.FRecords = [];
    this.FIndex = -1;
    this.FBof = this.FEof = true;
    this.FEditBuffer = this.FOldValues = null;
    this.DataEvent('deActiveChanged');
    this.DataEvent('deUpdateState');
    this.Fire(this.AfterClose);
  }

  /** Reloads the data, trying to keep the current position. */
  async Refresh(): Promise<void> {
    if (!this.FActive) return this.Open();
    this.CheckBrowseMode();
    const keep = this.FIndex;
    const data = await this.DoOpenData();
    this.SetData(data);
    this.FIndex = this.FRecords.length ? clamp(keep, 0, this.FRecords.length - 1) : -1;
    this.FBof = this.FIndex <= 0;
    this.FEof = this.FRecords.length === 0;
    this.DataEvent('deDataSetChange');
  }

  protected SetData(data: TQueryResultJSON): void {
    const fields = (data.columns ?? []).map((c, i) => {
      const f = new TField(this);
      f.FieldName = c.name;
      f.SqlType = c.type ?? '';
      f.DataType = c.field_type ?? 'ftUnknown';
      f.Required = c.nullable === false && !c.autoincrement;
      f.IsPrimaryKey = !!c.primary_key;
      f.AutoIncrement = !!c.autoincrement;
      f.Size = c.size ?? 0;
      f.Index = i;
      return f;
    });
    this.FFields.SetItems(fields);
    this.FPrimaryKey = data.primary_key ?? fields.filter((f) => f.IsPrimaryKey).map((f) => f.FieldName);
    const names = fields.map((f) => f.FieldName);
    this.FRecords = (data.rows ?? []).map((row) => {
      const r: TRecord = {};
      names.forEach((n, i) => (r[n] = row[i]));
      return r;
    });
    this.FTruncated = !!data.truncated;
  }

  protected abstract DoOpenData(): Promise<TQueryResultJSON>;

  /** Writes one change to the backend; may return server generated values (e.g. ids). */
  protected DoApply(_Kind: 'insert' | 'update' | 'delete', _Rec: TRecord, _Old: TRecord | null): Promise<TRecord | void> {
    return Promise.reject(new EDatabaseError(`${this.Name || this.ClassName} salt okunur`));
  }

  protected ConnectionIdOrThrow(): string {
    if (!this.FConnection) throw new EDatabaseError(`${this.Name}: Connection özelliği atanmamış`);
    return this.FConnection.ConnectionId;
  }

  protected CheckActive(): void {
    if (!this.FActive) throw new EDatabaseError(`${this.Name || this.ClassName}: veri kümesi kapalı`);
  }

  /* -------------------------------------------------------- navigation -- */

  /** Posts pending edits (optimistically) before navigating — Delphi CheckBrowseMode. */
  CheckBrowseMode(): void {
    this.CheckActive();
    if (this.FState === 'dsEdit' || this.FState === 'dsInsert') {
      if (this.FModified) void this.Post().catch((e) => Application.HandleException(e, this));
      else this.Cancel();
    }
  }

  /** Moves the cursor; Bof/Eof are set when the request falls outside the records. */
  private MoveTo(Index: number): void {
    this.CheckBrowseMode();
    const n = this.FRecords.length;
    if (n === 0) {
      this.FIndex = -1;
      this.FBof = this.FEof = true;
      return;
    }
    const target = clamp(Index, 0, n - 1);
    this.FBof = Index < 0;
    this.FEof = Index >= n;
    if (target === this.FIndex) return;
    this.Fire(this.BeforeScroll);
    this.FIndex = target;
    this.DataEvent('deDataSetScroll');
    this.Fire(this.AfterScroll);
  }

  First(): void {
    this.CheckActive();
    this.MoveTo(0);
    this.FBof = true;
    this.FEof = this.FRecords.length === 0;
  }

  Last(): void {
    this.CheckActive();
    this.MoveTo(this.FRecords.length - 1);
    this.FEof = true;
    this.FBof = this.FRecords.length === 0;
  }

  /** Next on the last record sets Eof (classic `while (!ds.Eof) { …; ds.Next(); }` loop). */
  Next(): void {
    this.CheckActive();
    this.MoveTo(this.FIndex + 1);
  }

  Prior(): void {
    this.CheckActive();
    this.MoveTo(this.FIndex - 1);
  }

  MoveBy(Distance: number): number {
    const before = this.FIndex;
    this.MoveTo(this.FIndex + toInt(Distance));
    return this.FIndex - before;
  }

  /** Locate('sehir;aktif', ['Ankara', true], { caseInsensitive: true }) */
  Locate(KeyFields: string, KeyValues: unknown, Options: { caseInsensitive?: boolean; partialKey?: boolean } = {}): boolean {
    this.CheckActive();
    const names = KeyFields.split(';').map((s) => s.trim()).filter(Boolean);
    const values = Array.isArray(KeyValues) ? KeyValues : [KeyValues];
    const norm = (v: unknown) => (Options.caseInsensitive ? String(v ?? '').toLocaleLowerCase('tr') : String(v ?? ''));
    const idx = this.FRecords.findIndex((r) =>
      names.every((n, i) => {
        const a = norm(r[n]), b = norm(values[i]);
        return Options.partialKey ? a.startsWith(b) : a === b;
      }),
    );
    if (idx < 0) return false;
    this.MoveTo(idx);
    return true;
  }

  Lookup(KeyFields: string, KeyValues: unknown, ResultFields: string): unknown {
    const names = KeyFields.split(';').map((s) => s.trim());
    const values = Array.isArray(KeyValues) ? KeyValues : [KeyValues];
    const rec = this.FRecords.find((r) => names.every((n, i) => String(r[n] ?? '') === String(values[i] ?? '')));
    if (!rec) return null;
    const res = ResultFields.split(';').map((s) => s.trim());
    return res.length === 1 ? rec[res[0]] : res.map((n) => rec[n]);
  }

  /** Iterates all records: `ds.ForEach(r => console.log(r.ad))` (return false to stop). */
  ForEach(Callback: (Rec: Readonly<TRecord>, Index: number) => void | boolean): void {
    for (let i = 0; i < this.FRecords.length; i++) if (Callback(this.FRecords[i], i) === false) break;
  }

  ToArray(): TRecord[] {
    return this.FRecords.map((r) => ({ ...r }));
  }

  /* ------------------------------------------------------------ fields -- */

  FieldByName(Name: string): TField {
    return this.FFields.FieldByName(Name);
  }

  FindField(Name: string): TField | null {
    return this.FFields.FindField(Name);
  }

  FieldValues(Name: string): unknown {
    return this.FieldByName(Name).Value;
  }

  GetFieldValue(Name: string): unknown {
    const r = this.FEditBuffer ?? this.FRecords[this.FIndex];
    return r ? r[Name] ?? null : null;
  }

  SetFieldValue(Name: string, Value: unknown): void {
    this.CheckActive();
    const f = this.FieldByName(Name);
    if (this.FState === 'dsBrowse') this.Edit();
    if (!this.FEditBuffer) throw new EDatabaseError('Veri kümesi düzenleme modunda değil');
    if (f.ReadOnly) throw new EDatabaseError(`'${Name}' alanı salt okunur`);
    this.FEditBuffer[f.FieldName] = Value;
    this.FModified = true;
    this.DataEvent('deFieldChange', f);
  }

  /* ---------------------------------------------------------- editing -- */

  Edit(): void {
    this.CheckActive();
    if (this.FState === 'dsEdit' || this.FState === 'dsInsert') return;
    if (!this.CanModify) throw new EDatabaseError(`${this.Name || this.ClassName} düzenlenemez (salt okunur)`);
    if (this.FIndex < 0) throw new EDatabaseError('Düzenlenecek kayıt yok');
    this.Fire(this.BeforeEdit);
    this.FOldValues = { ...this.FRecords[this.FIndex] };
    this.FEditBuffer = { ...this.FRecords[this.FIndex] };
    this.FModified = false;
    this.FState = 'dsEdit';
    this.DataEvent('deUpdateState');
    this.Fire(this.AfterEdit);
  }

  Insert(): void {
    this.StartInsert(Math.max(0, this.FIndex));
  }

  Append(): void {
    this.StartInsert(this.FRecords.length);
  }

  private StartInsert(At: number): void {
    this.CheckBrowseMode();
    if (!this.CanModify) throw new EDatabaseError(`${this.Name || this.ClassName} düzenlenemez (salt okunur)`);
    this.Fire(this.BeforeInsert);
    const blank: TRecord = {};
    for (const f of this.FFields) blank[f.FieldName] = null;
    this.FEditBuffer = blank;
    this.FOldValues = null;
    this.FModified = false;
    this.FIndex = clamp(At, 0, this.FRecords.length);
    this.FState = 'dsInsert';
    this.Fire(this.OnNewRecord);
    this.DataEvent('deUpdateState');
    this.DataEvent('deDataSetChange');
    this.Fire(this.AfterInsert);
  }

  Cancel(): void {
    if (this.FState !== 'dsEdit' && this.FState !== 'dsInsert') return;
    this.Fire(this.BeforeCancel);
    const wasInsert = this.FState === 'dsInsert';
    this.FEditBuffer = this.FOldValues = null;
    this.FModified = false;
    this.FState = 'dsBrowse';
    if (wasInsert) this.FIndex = Math.min(this.FIndex, this.FRecords.length - 1);
    this.DataEvent('deUpdateState');
    this.DataEvent('deDataSetChange');
    this.Fire(this.AfterCancel);
  }

  /** Saves the edit buffer (optimistic; rolled back when the backend rejects it). */
  async Post(): Promise<void> {
    if (this.FState !== 'dsEdit' && this.FState !== 'dsInsert') return;
    this.Fire(this.BeforePost);
    for (const f of this.FFields) {
      if (f.Required && !f.AutoIncrement && (this.FEditBuffer![f.FieldName] === null || this.FEditBuffer![f.FieldName] === undefined || this.FEditBuffer![f.FieldName] === '')) {
        throw new EDatabaseError(`'${f.DisplayName}' alanı boş bırakılamaz`);
      }
    }
    const kind = this.FState === 'dsInsert' ? 'insert' : 'update';
    const rec = { ...this.FEditBuffer! };
    const old = this.FOldValues ? { ...this.FOldValues } : null;
    const index = this.FIndex;
    if (kind === 'insert') this.FRecords.splice(index, 0, rec);
    else this.FRecords[index] = rec;
    this.FEditBuffer = this.FOldValues = null;
    this.FModified = false;
    this.FState = 'dsBrowse';
    this.FEof = this.FBof = false;
    this.DataEvent('deUpdateState');
    this.DataEvent('deDataSetChange');
    try {
      const server = await this.DoApply(kind, rec, old);
      if (server && typeof server === 'object') {
        Object.assign(rec, server);
        this.DataEvent('deRecordChange');
      }
      this.Fire(this.AfterPost);
    } catch (e) {
      const pos = this.FRecords.indexOf(rec);
      if (pos >= 0) {
        if (kind === 'insert') this.FRecords.splice(pos, 1);
        else if (old) this.FRecords[pos] = old;
      }
      this.FIndex = clamp(this.FIndex, -1, this.FRecords.length - 1);
      this.DataEvent('deDataSetChange');
      const err = e instanceof Error ? e : new EDatabaseError(String(e));
      if (this.OnPostError) this.Fire(this.OnPostError, { Error: err });
      throw err;
    }
  }

  async Delete(): Promise<void> {
    this.CheckActive();
    if (this.FState === 'dsInsert') {
      this.Cancel();
      return;
    }
    if (this.FIndex < 0) throw new EDatabaseError('Silinecek kayıt yok');
    if (!this.CanModify) throw new EDatabaseError(`${this.Name || this.ClassName} düzenlenemez (salt okunur)`);
    if (this.FState === 'dsEdit') this.Cancel();
    this.Fire(this.BeforeDelete);
    const index = this.FIndex;
    const [rec] = this.FRecords.splice(index, 1);
    this.FIndex = Math.min(index, this.FRecords.length - 1);
    this.FEof = this.FRecords.length === 0;
    this.DataEvent('deDataSetChange');
    try {
      await this.DoApply('delete', rec, rec);
      this.Fire(this.AfterDelete);
    } catch (e) {
      this.FRecords.splice(index, 0, rec);
      this.FIndex = index;
      this.DataEvent('deDataSetChange');
      throw e;
    }
  }

  /* ------------------------------------------------------ notifications -- */

  DisableControls(): void {
    this.FDisableCount++;
  }

  EnableControls(): void {
    if (this.FDisableCount > 0 && --this.FDisableCount === 0 && this.FPendingEvent) {
      this.FPendingEvent = false;
      this.DataEvent('deDataSetChange');
    }
  }

  RegisterDataSource(ds: TDataSource): void {
    this.FDataSources.add(ds);
  }

  UnregisterDataSource(ds: TDataSource): void {
    this.FDataSources.delete(ds);
  }

  protected DataEvent(Event: TDataEvent, Info?: unknown): void {
    if (this.FDisableCount > 0 && Event !== 'deActiveChanged' && Event !== 'deUpdateState') {
      this.FPendingEvent = true;
      return;
    }
    for (const ds of [...this.FDataSources]) ds.DataEvent(Event, Info);
  }

  protected override Loaded(): void {
    super.Loaded();
    if (this.FStreamedActive) {
      this.FStreamedActive = false;
      void this.Open().catch((e) => {
        if (this.Designing) console.warn(`[VCL] ${this.Name}: ${e instanceof Error ? e.message : String(e)}`);
        else Application.HandleException(e, this);
      });
    }
  }

  override Notification(AComponent: TComponent, Operation: TOperation): void {
    super.Notification(AComponent, Operation);
    if (Operation === 'opRemove' && AComponent === this.FConnection) this.Connection = null;
  }

  override Destroy(): void {
    if (this.Destroying) return;
    this.Close();
    this.FConnection?.UnregisterDataSet(this);
    super.Destroy();
  }
}

/** TQuery — dataset defined by a parameterised SQL statement. */
export class TQuery extends TDataSet {
  readonly SQL = new TStrings();
  readonly Params = new TParams();
  protected FParamCheck = true;
  RowsAffected = 0;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.SQL.OnChange = () => {
      if (this.FActive) this.Close();
      if (this.FParamCheck) this.Params.ParseSQL(this.SQL.Text);
    };
  }

  get ParamCheck(): boolean {
    return this.FParamCheck;
  }
  set ParamCheck(v: boolean) {
    this.FParamCheck = !!v;
  }

  ParamByName(Name: string): TParam {
    return this.Params.ParamByName(Name);
  }

  /** Executes INSERT/UPDATE/DELETE. Returns (and stores) RowsAffected. */
  async ExecSQL(): Promise<number> {
    const r = await DataService.Query(this.ConnectionIdOrThrow(), this.SQL.Text, this.Params.ToValues(), { mode: 'exec' });
    this.RowsAffected = r.rows_affected ?? 0;
    return this.RowsAffected;
  }

  Prepare(): void {
    /* statements are prepared by the backend driver */
  }

  protected DoOpenData(): Promise<TQueryResultJSON> {
    if (!this.SQL.Text.trim()) return Promise.reject(new EDatabaseError(`${this.Name}: SQL boş`));
    return DataService.Query(this.ConnectionIdOrThrow(), this.SQL.Text, this.Params.ToValues(), { max_rows: this.FMaxRows, mode: 'query' });
  }
}

/** TTable — whole-table dataset with inserts/updates/deletes through the backend table API. */
export class TTable extends TDataSet {
  protected FTableName = '';
  protected FIndexFieldNames = '';
  protected FFieldList = '';
  protected FReadOnly = false;
  protected FMasterSource: TDataSource | null = null;
  protected FMasterFields = '';
  private FMasterLink: TDataLink;
  private FMasterRefreshQueued = false;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FMasterLink = new TDataLink((ev) => this.MasterChanged(ev));
  }

  get TableName(): string {
    return this.FTableName;
  }
  set TableName(v: string) {
    v = String(v ?? '');
    if (v === this.FTableName) return;
    if (this.FActive) this.Close();
    this.FTableName = v;
  }

  /** "soyad;ad" — ORDER BY columns (prefix with "-" for descending). */
  get IndexFieldNames(): string {
    return this.FIndexFieldNames;
  }
  set IndexFieldNames(v: string) {
    this.FIndexFieldNames = String(v ?? '');
    if (this.FActive && !this.Loading) void this.Refresh().catch((e) => Application.HandleException(e, this));
  }

  /** Semicolon separated column list to fetch (empty = all columns). */
  get FieldList(): string {
    return this.FFieldList;
  }
  set FieldList(v: string) {
    this.FFieldList = String(v ?? '');
  }

  get ReadOnly(): boolean {
    return this.FReadOnly;
  }
  set ReadOnly(v: boolean) {
    this.FReadOnly = !!v;
  }

  get MasterSource(): TDataSource | null {
    return this.FMasterSource;
  }
  set MasterSource(v: TDataSource | null) {
    this.RemoveFreeNotification(this.FMasterSource);
    this.FMasterSource = v;
    this.FreeNotification(v);
    this.FMasterLink.DataSource = v;
  }

  /** "musteri_id=id" — detail field = master field pairs separated by ';'. */
  get MasterFields(): string {
    return this.FMasterFields;
  }
  set MasterFields(v: string) {
    this.FMasterFields = String(v ?? '');
  }

  override get CanModify(): boolean {
    return !this.FReadOnly && this.FPrimaryKey.length > 0;
  }

  override Notification(AComponent: TComponent, Operation: TOperation): void {
    super.Notification(AComponent, Operation);
    if (Operation === 'opRemove' && AComponent === this.FMasterSource) this.MasterSource = null;
  }

  private MasterWhere(): Record<string, unknown> | null {
    const master = this.FMasterLink.DataSet;
    if (!this.FMasterSource || !this.FMasterFields.trim()) return null;
    const where: Record<string, unknown> = {};
    for (const pair of this.FMasterFields.split(';')) {
      const [detail, masterField] = pair.split('=').map((s) => s.trim());
      if (!detail) continue;
      where[detail] = master && master.Active ? master.GetFieldValue(masterField || detail) : null;
    }
    return where;
  }

  private MasterChanged(ev: TDataEvent): void {
    if (!this.FActive || this.FMasterRefreshQueued) return;
    if (ev !== 'deDataSetScroll' && ev !== 'deDataSetChange' && ev !== 'deActiveChanged' && ev !== 'deRecordChange') return;
    this.FMasterRefreshQueued = true;
    queueMicrotask(() => {
      this.FMasterRefreshQueued = false;
      if (this.FActive && this.FState === 'dsBrowse') void this.Refresh().catch((e) => Application.HandleException(e, this));
    });
  }

  protected DoOpenData(): Promise<TQueryResultJSON> {
    if (!this.FTableName) return Promise.reject(new EDatabaseError(`${this.Name}: TableName boş`));
    const order_by = this.FIndexFieldNames.split(';').map((s) => s.trim()).filter(Boolean).map((s) => (s.startsWith('-') ? { column: s.slice(1), desc: true } : { column: s, desc: false }));
    const columns = this.FFieldList.split(';').map((s) => s.trim()).filter(Boolean);
    const where = this.MasterWhere();
    return DataService.Table(this.ConnectionIdOrThrow(), {
      op: 'select',
      table: this.FTableName,
      columns: columns.length ? columns : undefined,
      where: where ?? undefined,
      order_by,
      limit: this.FMaxRows,
    });
  }

  protected override DoApply(Kind: 'insert' | 'update' | 'delete', Rec: TRecord, Old: TRecord | null): Promise<TRecord | void> {
    const conn = this.ConnectionIdOrThrow();
    const key = (src: TRecord | null) => Object.fromEntries(this.FPrimaryKey.map((k) => [k, (src ?? Rec)[k]]));
    if (Kind === 'insert') {
      const values: TRecord = {};
      for (const f of this.FFields) {
        const v = Rec[f.FieldName];
        if (f.AutoIncrement && (v === null || v === undefined || v === '')) continue;
        if (v !== undefined) values[f.FieldName] = v;
      }
      // Detail tables inherit the master key automatically.
      Object.assign(values, Object.fromEntries(Object.entries(this.MasterWhere() ?? {}).filter(([k]) => values[k] === null || values[k] === undefined)));
      return DataService.Table(conn, { op: 'insert', table: this.FTableName, values }).then((r) => ({ ...values, ...(r.inserted_primary_key ?? {}) }));
    }
    if (Kind === 'update') {
      const values: TRecord = {};
      for (const f of this.FFields) if (Old && Rec[f.FieldName] !== Old[f.FieldName]) values[f.FieldName] = Rec[f.FieldName];
      if (!Object.keys(values).length) return Promise.resolve();
      return DataService.Table(conn, { op: 'update', table: this.FTableName, values, key: key(Old) }).then(() => undefined);
    }
    return DataService.Table(conn, { op: 'delete', table: this.FTableName, key: key(Old) }).then(() => undefined);
  }
}

/** TStoredProc — calls a stored procedure/function; result rows become the dataset. */
export class TStoredProc extends TDataSet {
  protected FStoredProcName = '';
  readonly Params = new TParams();

  get StoredProcName(): string {
    return this.FStoredProcName;
  }
  set StoredProcName(v: string) {
    this.FStoredProcName = String(v ?? '');
  }

  ParamByName(Name: string): TParam {
    return this.Params.ParamByName(Name);
  }

  async ExecProc(): Promise<void> {
    await DataService.Proc(this.ConnectionIdOrThrow(), this.FStoredProcName, this.Params.ToValues());
  }

  protected DoOpenData(): Promise<TQueryResultJSON> {
    if (!this.FStoredProcName) return Promise.reject(new EDatabaseError(`${this.Name}: StoredProcName boş`));
    return DataService.Proc(this.ConnectionIdOrThrow(), this.FStoredProcName, this.Params.ToValues());
  }
}

/* ======================================================== data controls == */

export interface TGridColumnJSON {
  FieldName: string;
  Title?: string;
  Width?: number;
  Alignment?: TAlignment;
  Visible?: boolean;
  /** Numeric display format, e.g. "#,##0.00" (Delphi TNumericField.DisplayFormat). */
  DisplayFormat?: string;
}

export interface TGridCellEventArgs {
  Column: TGridColumnJSON;
  Field: TField | null;
  Row: number;
}

interface TGridColumnRuntime {
  def: TGridColumnJSON;
  field: TField | null;
  width: number;
  title: string;
  align: TAlignment;
}

/** TDBGrid — virtualised, editable data grid bound to a TDataSource. */
export class TDBGrid extends TWinControl {
  protected FColumns: TGridColumnJSON[] = [];
  protected FOptions: TGridOption[] = ['dgTitles', 'dgIndicator', 'dgColLines', 'dgRowLines', 'dgStriped', 'dgEditing'];
  protected FReadOnly = false;
  protected FRowHeight = 24;
  private FLink: TDataLink;
  private FScroll: HTMLDivElement | null = null;
  private FTable: HTMLDivElement | null = null;
  private FHead: HTMLDivElement | null = null;
  private FBody: HTMLDivElement | null = null;
  private FEmpty: HTMLDivElement | null = null;
  private FCols: TGridColumnRuntime[] = [];
  private FEditor: HTMLInputElement | null = null;
  private FRenderQueued = false;
  OnCellClick: TEventHandler<TGridCellEventArgs> | null = null;
  OnTitleClick: TEventHandler<{ Column: TGridColumnJSON }> | null = null;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FColor = 'clWindow';
    this.FParentColor = false;
    this.FLink = new TDataLink((ev) => this.LinkEvent(ev));
  }

  protected override GetDefaultSize() {
    return { w: 320, h: 120 };
  }

  override AcceptsControl(): boolean {
    return false;
  }

  get DataSource(): TDataSource | null {
    return this.FLink.DataSource;
  }
  set DataSource(v: TDataSource | null) {
    this.RemoveFreeNotification(this.FLink.DataSource);
    this.FLink.DataSource = v;
    this.FreeNotification(v);
  }

  get Columns(): TGridColumnJSON[] {
    return this.FColumns.map((c) => ({ ...c }));
  }
  set Columns(v: TGridColumnJSON[]) {
    this.FColumns = (Array.isArray(v) ? v : []).filter((c) => c && typeof c.FieldName === 'string').map((c) => ({ ...c }));
    this.QueueRender();
  }

  get Options(): TGridOption[] {
    return this.FOptions.slice();
  }
  set Options(v: TGridOption[]) {
    this.FOptions = Array.isArray(v) ? v.slice() : [];
    this.QueueRender();
  }

  get ReadOnly(): boolean {
    return this.FReadOnly;
  }
  set ReadOnly(v: boolean) {
    this.FReadOnly = !!v;
  }

  get DefaultRowHeight(): number {
    return this.FRowHeight;
  }
  set DefaultRowHeight(v: number) {
    this.FRowHeight = clamp(toInt(v, 24), 16, 80);
    this.QueueRender();
  }

  /** Field of the selected column (first column when none). */
  get SelectedField(): TField | null {
    return this.FCols[0]?.field ?? null;
  }

  override Notification(AComponent: TComponent, Operation: TOperation): void {
    super.Notification(AComponent, Operation);
    if (Operation === 'opRemove' && AComponent === this.FLink.DataSource) this.DataSource = null;
  }

  private has(o: TGridOption): boolean {
    return this.FOptions.includes(o);
  }

  protected override CreateElement(): HTMLElement {
    const e = document.createElement('div');
    this.FScroll = el('div', 'vcl-dbgrid-scroll', e);
    this.FTable = el('div', 'vcl-dbgrid-table', this.FScroll);
    this.FHead = el('div', 'vcl-dbgrid-head', this.FTable);
    this.FBody = el('div', 'vcl-dbgrid-body', this.FTable);
    this.FEmpty = el('div', 'vcl-dbgrid-empty', e);
    return e;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.FScroll!.addEventListener('scroll', () => this.RenderRows());
    this.FBody!.addEventListener('mousedown', (ev) => this.BodyMouseDown(ev));
    this.FBody!.addEventListener('dblclick', (ev) => this.BodyDblClick(ev));
    this.FElement!.addEventListener('keydown', (ev) => this.GridKeyDown(ev));
    this.Render();
  }

  protected override Resized(): void {
    super.Resized();
    this.RenderRows();
  }

  private LinkEvent(ev: TDataEvent): void {
    if (ev === 'deFieldChange' || ev === 'deRecordChange' || ev === 'deUpdateState' || ev === 'deDataSetScroll') {
      this.RenderRows();
      if (ev === 'deDataSetScroll') this.ScrollToCurrent();
      return;
    }
    this.QueueRender();
  }

  private QueueRender(): void {
    if (this.FRenderQueued || !this.FElement) return;
    this.FRenderQueued = true;
    queueMicrotask(() => {
      this.FRenderQueued = false;
      this.Render();
    });
  }

  private BuildColumns(): void {
    const ds = this.FLink.DataSet;
    const fields = ds?.Active ? ds.Fields.Items : [];
    const widthFor = (f: TField | null) => {
      if (!f) return 120;
      switch (f.DataType) {
        case 'ftInteger': return 70;
        case 'ftBoolean': return 60;
        case 'ftFloat': case 'ftCurrency': return 100;
        case 'ftDate': return 95;
        case 'ftDateTime': return 135;
        default: return 140;
      }
    };
    const defs: TGridColumnJSON[] = this.FColumns.length ? this.FColumns : fields.filter((f) => f.Visible).map((f) => ({ FieldName: f.FieldName }));
    this.FCols = defs
      .filter((d) => d.Visible !== false)
      .map((d) => {
        const field = fields.find((f) => f.FieldName.toLowerCase() === d.FieldName.toLowerCase()) ?? null;
        return { def: d, field, width: d.Width ?? widthFor(field), title: d.Title || field?.DisplayName || d.FieldName, align: d.Alignment ?? field?.Alignment ?? 'taLeftJustify' };
      });
  }

  private Render(): void {
    if (!this.FElement || !this.FHead) return;
    this.BuildColumns();
    const e = this.FElement;
    e.classList.toggle('vcl-grid-collines', this.has('dgColLines'));
    e.classList.toggle('vcl-grid-rowlines', this.has('dgRowLines'));
    e.classList.toggle('vcl-grid-striped', this.has('dgStriped'));
    e.classList.toggle('vcl-grid-rowselect', this.has('dgRowSelect'));
    e.style.setProperty('--vcl-row-h', `${this.FRowHeight}px`);
    const indicator = this.has('dgIndicator') ? 18 : 0;
    const total = indicator + this.FCols.reduce((s, c) => s + c.width, 0);
    this.FTable!.style.width = `${Math.max(total, 1)}px`;
    const head = this.FHead;
    head.textContent = '';
    head.style.display = this.has('dgTitles') ? '' : 'none';
    if (indicator) el('div', 'vcl-dbgrid-cell vcl-dbgrid-indicator', head).style.width = `${indicator}px`;
    for (const c of this.FCols) {
      const h = el('div', 'vcl-dbgrid-cell vcl-dbgrid-title', head);
      h.style.width = `${c.width}px`;
      h.textContent = c.title;
      h.style.textAlign = c.align === 'taRightJustify' ? 'right' : c.align === 'taCenter' ? 'center' : 'left';
      h.addEventListener('click', () => {
        if (!this.Designing) this.Fire(this.OnTitleClick, { Column: { ...c.def } });
      });
    }
    this.RenderRows();
  }

  private RowCount(): number {
    const ds = this.FLink.DataSet;
    if (!ds || !ds.Active) return 0;
    return ds.RecordCount + (ds.State === 'dsInsert' ? 1 : 0);
  }

  private RenderRows(): void {
    const body = this.FBody, scroll = this.FScroll, ds = this.FLink.DataSet;
    if (!body || !scroll) return;
    const count = this.RowCount();
    const rh = this.FRowHeight;
    body.style.height = `${count * rh}px`;
    body.textContent = '';
    this.FEmpty!.style.display = count === 0 && !this.Designing && ds?.Active ? '' : 'none';
    this.FEmpty!.textContent = 'Kayıt yok';
    if (!ds || count === 0) return;
    const headH = this.has('dgTitles') ? (this.FHead?.offsetHeight ?? rh) : 0;
    const viewH = Math.max(rh, scroll.clientHeight - headH);
    const first = Math.max(0, Math.floor(scroll.scrollTop / rh) - 2);
    const last = Math.min(count - 1, first + Math.ceil(viewH / rh) + 4);
    const indicator = this.has('dgIndicator');
    const current = ds.RecNo - 1;
    for (let r = first; r <= last; r++) {
      const rec = ds.RecordAt(r);
      const row = el('div', 'vcl-dbgrid-row', body);
      row.style.top = `${r * rh}px`;
      row.dataset.row = String(r);
      if (r % 2 === 1) row.classList.add('vcl-odd');
      if (r === current) row.classList.add('vcl-current');
      if (indicator) {
        const ind = el('div', 'vcl-dbgrid-cell vcl-dbgrid-indicator', row);
        ind.style.width = '18px';
        if (r === current) ind.textContent = ds.State === 'dsInsert' ? '✱' : ds.State === 'dsEdit' ? '✎' : '▸';
      }
      this.FCols.forEach((c, ci) => {
        const cell = el('div', 'vcl-dbgrid-cell', row);
        cell.style.width = `${c.width}px`;
        cell.dataset.col = String(ci);
        cell.style.textAlign = c.align === 'taRightJustify' ? 'right' : c.align === 'taCenter' ? 'center' : 'left';
        const v = rec ? rec[c.field?.FieldName ?? c.def.FieldName] : null;
        cell.textContent = c.def.DisplayFormat && typeof v === 'number'
          ? FormatFloat(c.def.DisplayFormat, v)
          : c.field && r === current ? c.field.DisplayText : this.FormatCell(c.field, v);
      });
    }
  }

  private FormatCell(f: TField | null, v: unknown): string {
    if (v === null || v === undefined) return '';
    if (!f) return String(v);
    switch (f.DataType) {
      case 'ftCurrency': return FormatFloat('#,##0.00', Number(v));
      case 'ftBoolean': return v ? '✓' : '✗';
      case 'ftFloat': return typeof v === 'number' ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(v) : String(v);
      case 'ftDate': {
        const d = new Date(String(v));
        return Number.isNaN(d.getTime()) ? String(v) : FormatDateTime('dd.mm.yyyy', d);
      }
      case 'ftDateTime': {
        const d = new Date(String(v));
        return Number.isNaN(d.getTime()) ? String(v) : FormatDateTime('dd.mm.yyyy hh:nn', d);
      }
      default: return String(v);
    }
  }

  private ScrollToCurrent(): void {
    const ds = this.FLink.DataSet, scroll = this.FScroll;
    if (!ds || !scroll) return;
    const r = ds.RecNo - 1;
    if (r < 0) return;
    const rh = this.FRowHeight;
    const headH = this.has('dgTitles') ? (this.FHead?.offsetHeight ?? rh) : 0;
    const top = r * rh, bottom = top + rh, viewH = scroll.clientHeight - headH;
    if (top < scroll.scrollTop) scroll.scrollTop = top;
    else if (bottom > scroll.scrollTop + viewH) scroll.scrollTop = bottom - viewH;
  }

  private CellFromEvent(ev: MouseEvent): { row: number; col: number } | null {
    const cell = (ev.target as HTMLElement).closest('.vcl-dbgrid-cell') as HTMLElement | null;
    const row = cell?.parentElement as HTMLElement | null;
    if (!cell || !row?.dataset.row) return null;
    return { row: Number(row.dataset.row), col: cell.dataset.col ? Number(cell.dataset.col) : -1 };
  }

  private BodyMouseDown(ev: MouseEvent): void {
    if (this.Designing || !this.FEnabled) return;
    const hit = this.CellFromEvent(ev);
    const ds = this.FLink.DataSet;
    if (!hit || !ds || !ds.Active) return;
    this.CommitEditor();
    try {
      if (ds.State === 'dsBrowse' || hit.row !== ds.RecNo - 1) ds.RecNo = hit.row + 1;
    } catch (e) {
      Application.HandleException(e, this);
    }
    if (hit.col >= 0) {
      const c = this.FCols[hit.col];
      this.Fire(this.OnCellClick, { Column: { ...c.def }, Field: c.field, Row: hit.row });
    }
  }

  private BodyDblClick(ev: MouseEvent): void {
    if (this.Designing) return;
    const hit = this.CellFromEvent(ev);
    if (hit && hit.col >= 0) this.BeginEdit(hit.row, hit.col);
  }

  private CanEdit(): boolean {
    const ds = this.FLink.DataSet;
    return !!ds && ds.Active && ds.CanModify && !this.FReadOnly && this.has('dgEditing') && !this.has('dgRowSelect');
  }

  private BeginEdit(row: number, col: number): void {
    if (!this.CanEdit()) return;
    const c = this.FCols[col];
    if (!c?.field || c.field.ReadOnly || c.field.AutoIncrement) return;
    const cell = this.FBody?.querySelector(`.vcl-dbgrid-row[data-row="${row}"] .vcl-dbgrid-cell[data-col="${col}"]`) as HTMLElement | null;
    if (!cell) return;
    const ds = this.FLink.DataSet!;
    const input = document.createElement('input');
    input.className = 'vcl-dbgrid-editor';
    input.value = c.field.AsString;
    cell.textContent = '';
    cell.appendChild(input);
    this.FEditor = input;
    input.dataset.field = c.field.FieldName;
    input.focus();
    input.select();
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        ev.stopPropagation();
        this.CommitEditor(true);
        this.FElement?.focus();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        this.FEditor = null;
        if (ds.State === 'dsEdit' && !ds.Modified) ds.Cancel();
        this.RenderRows();
        this.FElement?.focus();
      }
    });
    input.addEventListener('blur', () => this.CommitEditor());
  }

  private CommitEditor(post = false): void {
    const input = this.FEditor;
    if (!input) return;
    this.FEditor = null;
    const ds = this.FLink.DataSet;
    const name = input.dataset.field!;
    try {
      if (ds && ds.Active) {
        const f = ds.FieldByName(name);
        if (f.AsString !== input.value) f.AsString = input.value;
        if (post && (ds.State === 'dsEdit' || ds.State === 'dsInsert')) void ds.Post().catch((e) => Application.HandleException(e, this));
      }
    } catch (e) {
      Application.HandleException(e, this);
    }
    this.RenderRows();
  }

  private GridKeyDown(ev: KeyboardEvent): void {
    const ds = this.FLink.DataSet;
    if (this.Designing || !ds || !ds.Active || this.FEditor) return;
    const page = Math.max(1, Math.floor((this.FScroll?.clientHeight ?? 100) / this.FRowHeight) - 1);
    const run = (f: () => void) => {
      ev.preventDefault();
      try {
        f();
      } catch (e) {
        Application.HandleException(e, this);
      }
    };
    switch (ev.key) {
      case 'ArrowDown': run(() => ds.Next()); break;
      case 'ArrowUp': run(() => ds.Prior()); break;
      case 'PageDown': run(() => ds.MoveBy(page)); break;
      case 'PageUp': run(() => ds.MoveBy(-page)); break;
      case 'Home': if (ev.ctrlKey) run(() => ds.First()); break;
      case 'End': if (ev.ctrlKey) run(() => ds.Last()); break;
      case 'Insert': if (this.CanEdit()) run(() => ds.Insert()); break;
      case 'Escape': if (ds.State !== 'dsBrowse') run(() => ds.Cancel()); break;
      case 'Enter': if (ds.State !== 'dsBrowse') run(() => void ds.Post().catch((e) => Application.HandleException(e, this))); break;
      case 'F2': run(() => this.BeginEdit(ds.RecNo - 1, 0)); break;
      default: break;
    }
  }
}

const NAV_ICONS: Record<TNavigateBtn, [string[], string]> = {
  nbFirst: [['M4 3v10', 'M12 3L6 8l6 5'], 'İlk kayıt'],
  nbPrior: [['M10 3L5 8l5 5'], 'Önceki kayıt'],
  nbNext: [['M6 3l5 5-5 5'], 'Sonraki kayıt'],
  nbLast: [['M12 3v10', 'M4 3l6 5-6 5'], 'Son kayıt'],
  nbInsert: [['M8 3v10', 'M3 8h10'], 'Kayıt ekle'],
  nbDelete: [['M3 8h10'], 'Kaydı sil'],
  nbEdit: [['M10.5 2.5l3 3L6 13H3v-3z'], 'Düzenle'],
  nbPost: [['M3 8.5l3.5 3.5L13 4.5'], 'Kaydet (Post)'],
  nbCancel: [['M4 4l8 8', 'M12 4l-8 8'], 'İptal'],
  nbRefresh: [['M13 8a5 5 0 1 1-1.5-3.5', 'M13 2.5V5h-2.5'], 'Yenile'],
};

const ALL_NAV_BUTTONS: TNavigateBtn[] = ['nbFirst', 'nbPrior', 'nbNext', 'nbLast', 'nbInsert', 'nbDelete', 'nbEdit', 'nbPost', 'nbCancel', 'nbRefresh'];

/** TDBNavigator — First/Prior/Next/Last/Insert/Delete/Edit/Post/Cancel/Refresh buttons. */
export class TDBNavigator extends TWinControl {
  protected FVisibleButtons: TNavigateBtn[] = ALL_NAV_BUTTONS.slice();
  protected FConfirmDelete = true;
  private FLink: TDataLink;
  private FButtons = new Map<TNavigateBtn, HTMLButtonElement>();

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FTabStop = false;
    this.FLink = new TDataLink(() => this.UpdateButtons());
  }

  protected override GetDefaultSize() {
    return { w: 240, h: 25 };
  }

  override AcceptsControl(): boolean {
    return false;
  }

  get DataSource(): TDataSource | null {
    return this.FLink.DataSource;
  }
  set DataSource(v: TDataSource | null) {
    this.RemoveFreeNotification(this.FLink.DataSource);
    this.FLink.DataSource = v;
    this.FreeNotification(v);
  }

  get VisibleButtons(): TNavigateBtn[] {
    return this.FVisibleButtons.slice();
  }
  set VisibleButtons(v: TNavigateBtn[]) {
    this.FVisibleButtons = ALL_NAV_BUTTONS.filter((b) => Array.isArray(v) && v.includes(b));
    this.BuildButtons();
  }

  get ConfirmDelete(): boolean {
    return this.FConfirmDelete;
  }
  set ConfirmDelete(v: boolean) {
    this.FConfirmDelete = !!v;
  }

  override Notification(AComponent: TComponent, Operation: TOperation): void {
    super.Notification(AComponent, Operation);
    if (Operation === 'opRemove' && AComponent === this.FLink.DataSource) this.DataSource = null;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.BuildButtons();
  }

  private BuildButtons(): void {
    const e = this.FElement;
    if (!e) return;
    e.textContent = '';
    this.FButtons.clear();
    for (const btn of this.FVisibleButtons) {
      const [paths, title] = NAV_ICONS[btn];
      const b = el('button', 'vcl-nav-button', e);
      b.type = 'button';
      b.title = title;
      b.tabIndex = -1;
      b.appendChild(svgIcon(paths, 14, 'vcl-svg vcl-stroke'));
      b.addEventListener('click', () => {
        if (!this.Designing) void this.BtnClick(btn);
      });
      this.FButtons.set(btn, b);
    }
    this.UpdateButtons();
  }

  private UpdateButtons(): void {
    const ds = this.FLink.DataSet;
    const active = !!ds?.Active && !this.Designing;
    const editing = active && (ds!.State === 'dsEdit' || ds!.State === 'dsInsert');
    const browse = active && !editing;
    const can = active && ds!.CanModify;
    const state: Record<TNavigateBtn, boolean> = {
      nbFirst: browse && !ds!.Bof, nbPrior: browse && !ds!.Bof, nbNext: browse && !ds!.Eof, nbLast: browse && !ds!.Eof,
      nbInsert: can && browse, nbDelete: can && browse && !ds!.IsEmpty, nbEdit: can && browse && !ds!.IsEmpty,
      nbPost: editing, nbCancel: editing, nbRefresh: browse,
    };
    for (const [btn, b] of this.FButtons) b.disabled = !state[btn] && !this.Designing;
  }

  /** Performs a navigator action (Delphi BtnClick). */
  async BtnClick(Button: TNavigateBtn): Promise<void> {
    const ds = this.FLink.DataSet;
    if (!ds) return;
    try {
      switch (Button) {
        case 'nbFirst': ds.First(); break;
        case 'nbPrior': ds.Prior(); break;
        case 'nbNext': ds.Next(); break;
        case 'nbLast': ds.Last(); break;
        case 'nbInsert': ds.Insert(); break;
        case 'nbEdit': ds.Edit(); break;
        case 'nbCancel': ds.Cancel(); break;
        case 'nbPost': await ds.Post(); break;
        case 'nbRefresh': await ds.Refresh(); break;
        case 'nbDelete':
          if (!this.FConfirmDelete || (await Confirm('Kayıt silinsin mi?'))) await ds.Delete();
          break;
      }
      this.Fire(this.OnClick, { Button });
    } catch (e) {
      Application.HandleException(e, this);
    }
    this.UpdateButtons();
  }
}

/** TDBEdit — TEdit bound to one field of the current record. */
export class TDBEdit extends TEdit {
  protected FDataField = '';
  private FLink: TDataLink;
  private FUpdating = false;

  constructor(AOwner: TComponent | null = null) {
    super(AOwner);
    this.FLink = new TDataLink((ev, info) => this.LinkEvent(ev, info));
  }

  get DataSource(): TDataSource | null {
    return this.FLink.DataSource;
  }
  set DataSource(v: TDataSource | null) {
    this.RemoveFreeNotification(this.FLink.DataSource);
    this.FLink.DataSource = v;
    this.FreeNotification(v);
  }

  get DataField(): string {
    return this.FDataField;
  }
  set DataField(v: string) {
    this.FDataField = String(v ?? '');
    this.LinkEvent('deLayoutChange');
  }

  get Field(): TField | null {
    const ds = this.FLink.DataSet;
    return ds && ds.Active && this.FDataField ? ds.FindField(this.FDataField) : null;
  }

  override Notification(AComponent: TComponent, Operation: TOperation): void {
    super.Notification(AComponent, Operation);
    if (Operation === 'opRemove' && AComponent === this.FLink.DataSource) this.DataSource = null;
  }

  protected override ElementCreated(): void {
    super.ElementCreated();
    this.LinkEvent('deLayoutChange');
    this.Input.addEventListener('keydown', (ev) => {
      const ds = this.FLink.DataSet;
      if (this.Designing || !ds) return;
      if (ev.key === 'Escape' && (ds.State === 'dsEdit' || ds.State === 'dsInsert')) {
        ev.preventDefault();
        ds.Cancel();
      } else if (ev.key === 'Enter' && (ds.State === 'dsEdit' || ds.State === 'dsInsert')) {
        ev.preventDefault();
        void ds.Post().catch((e) => Application.HandleException(e, this));
      }
    });
  }

  private LinkEvent(ev: TDataEvent, info?: unknown): void {
    if (this.FUpdating || !this.FElement) return;
    if (ev === 'deFieldChange' && info instanceof TField && info.FieldName.toLowerCase() !== this.FDataField.toLowerCase()) return;
    const f = this.Field;
    this.FUpdating = true;
    try {
      if (this.Designing && !f) {
        this.Input.value = this.FDataField || this.Name;
        return;
      }
      const text = f ? f.AsString : '';
      this.FText = text;
      if (this.Input.value !== text) this.Input.value = text;
      this.Input.readOnly = this.FReadOnly || this.Designing || !f || f.ReadOnly || !this.FLink.DataSet?.CanModify;
    } finally {
      this.FUpdating = false;
    }
  }

  protected override TextChangedByUser(): void {
    const f = this.Field;
    const src = this.FLink.DataSource;
    if (!f || !src) return;
    if (!src.Edit()) {
      this.LinkEvent('deRecordChange');
      return;
    }
    this.FUpdating = true;
    try {
      f.AsString = this.FText;
    } catch (e) {
      Application.HandleException(e, this);
    } finally {
      this.FUpdating = false;
    }
  }
}

/* ============================================================ streaming == */

/** One node of a Form.design.tson component tree. */
export interface TDesignNode {
  class: string;
  name: string;
  props?: Record<string, unknown>;
  events?: Record<string, string>;
  children?: TDesignNode[];
}

/** Form{N}.design.tson — Delphi .dfm equivalent (canonical, diff friendly JSON). */
export interface TDesignDocument {
  format: 'jsd-design';
  version: number;
  form: TDesignNode;
}

/**
 * Applies one published property. The Object Inspector, LoadDesign and the
 * BuildService generated code all end up in exactly these setters (WYSIWYG).
 */
export function SetPropValue(
  Comp: TComponent,
  Info: TPropInfo | string,
  Value: unknown,
  Resolve?: (Name: string) => TComponent | null,
): void {
  const pi = typeof Info === 'string' ? FindPropInfo(RegisteredClassOf(Comp), Info) : Info;
  if (!pi) throw new EComponentError(`${Comp.ClassName} sınıfında '${String(Info)}' özelliği yok`);
  const t = Comp as unknown as Record<string, unknown>;
  switch (pi.kind) {
    case 'font':
      (t[pi.name] as TFont).FromJSON((Value ?? {}) as TFontJSON);
      break;
    case 'strings':
    case 'sql':
      (t[pi.name] as TStrings).SetStrings(Array.isArray(Value) ? Value : String(Value ?? '') === '' ? [] : String(Value).split(/\r?\n/));
      break;
    case 'params':
      (t[pi.name] as TParams).FromJSON(Value);
      break;
    case 'component': {
      let ref: TComponent | null = null;
      if (Value instanceof TComponent) ref = Value;
      else if (typeof Value === 'string' && Value) ref = Resolve ? Resolve(Value) : Comp.Owner?.FindComponent(Value) ?? null;
      if (ref && pi.refClass && !ref.InheritsFrom(pi.refClass)) {
        throw new EComponentError(`${pi.name}: ${ref.Name} bir ${pi.refClass} değil`);
      }
      t[pi.name] = ref;
      break;
    }
    case 'set':
      t[pi.name] = Array.isArray(Value) ? Value.filter((v) => !pi.values || pi.values.includes(String(v))) : [];
      break;
    case 'columns':
      t[pi.name] = Array.isArray(Value) ? Value.map((v) => ({ ...(v as object) })) : [];
      break;
    case 'int':
    case 'modalresult':
      t[pi.name] = toInt(Value, Number(pi.default ?? 0));
      break;
    case 'float':
      t[pi.name] = Number(Value) || 0;
      break;
    case 'bool':
      t[pi.name] = Value === true || Value === 'true' || Value === 1;
      break;
    case 'enum': {
      const v = String(Value ?? '');
      if (pi.values && !pi.values.includes(v)) throw new EComponentError(`${pi.name}: geçersiz değer '${v}'`);
      t[pi.name] = v;
      break;
    }
    case 'color': {
      const v = String(Value ?? '');
      if (v && !IsValidColor(v)) throw new EComponentError(`${pi.name}: geçersiz renk '${v}'`);
      t[pi.name] = v;
      break;
    }
    default:
      t[pi.name] = Value === null || Value === undefined ? '' : String(Value);
  }
}

/** Reads a published property as a JSON value (component references → names). */
export function GetPropValue(Comp: TComponent, Info: TPropInfo | string): unknown {
  const pi = typeof Info === 'string' ? FindPropInfo(RegisteredClassOf(Comp), Info) : Info;
  if (!pi) return undefined;
  const v = (Comp as unknown as Record<string, unknown>)[pi.name];
  switch (pi.kind) {
    case 'font':
      return (v as TFont).toJSON();
    case 'strings':
    case 'sql':
      return (v as TStrings).ToArray();
    case 'params':
      return (v as TParams).toJSON();
    case 'component':
      return v instanceof TComponent ? v.Name : null;
    case 'set':
      return Array.isArray(v) ? v.slice() : [];
    case 'columns':
      return Array.isArray(v) ? v.map((x) => ({ ...(x as object) })) : [];
    default:
      return v;
  }
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** True when a property value equals its RTTI default (and therefore is not written). */
export function IsDefaultPropValue(Info: TPropInfo, Value: unknown): boolean {
  if (Info.default === undefined) {
    if (Info.kind === 'strings' || Info.kind === 'sql' || Info.kind === 'params' || Info.kind === 'columns' || Info.kind === 'set') return Array.isArray(Value) && Value.length === 0;
    if (Info.kind === 'component') return Value === null || Value === undefined || Value === '';
    if (Info.kind === 'font') return jsonEqual(Value, new TFont().toJSON());
    return Value === '' || Value === undefined || Value === null;
  }
  return jsonEqual(Value, Info.default);
}

function applyNodeProps(
  Comp: TComponent,
  Node: TDesignNode,
  Refs: Array<[TComponent, TPropInfo, unknown]>,
  Warn: (m: string) => void,
): void {
  const info = GetClassInfo(RegisteredClassOf(Comp));
  if (!info) return;
  const props = Node.props ?? {};
  const known = new Set(info.props.map((p) => p.name));
  for (const key of Object.keys(props)) if (!known.has(key)) Warn(`${Node.name}: bilinmeyen özellik '${key}' atlandı`);
  for (const pi of info.props) {
    if (!(pi.name in props) || pi.stored === false || pi.readOnly) continue;
    if (pi.kind === 'component') {
      Refs.push([Comp, pi, props[pi.name]]);
      continue;
    }
    try {
      SetPropValue(Comp, pi, props[pi.name]);
    } catch (e) {
      Warn(`${Node.name}.${pi.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

/**
 * Streams a design document into a form (Delphi TReader): components are created in
 * pre-order, properties applied in RTTI order, component references resolved last,
 * then Loaded() runs for everything. The designer uses it with csDesigning set.
 */
export function LoadDesign(Form: TCustomForm, Doc: TDesignDocument | TDesignNode, Warn: (m: string) => void = (m) => console.warn(`[VCL] ${m}`)): Map<string, TComponent> {
  const root = 'form' in Doc ? Doc.form : Doc;
  const map = new Map<string, TComponent>();
  const refs: Array<[TComponent, TPropInfo, unknown]> = [];
  Form.BeginLoading();
  try {
    if (root.name && Form.Name !== root.name) Form.Name = root.name;
    map.set(Form.Name, Form);
    applyNodeProps(Form, root, refs, Warn);
    const walk = (nodes: TDesignNode[] | undefined, parent: TWinControl) => {
      for (const n of nodes ?? []) {
        const cls = FindClass(n.class);
        if (!cls) {
          Warn(`${n.name}: bilinmeyen sınıf '${n.class}'`);
          continue;
        }
        const c = new cls(Form);
        try {
          c.Name = n.name;
        } catch (e) {
          Warn(e instanceof Error ? e.message : String(e));
        }
        if (c instanceof TControl) c.Parent = parent;
        applyNodeProps(c, n, refs, Warn);
        map.set(c.Name, c);
        if (n.children?.length) {
          if (c instanceof TWinControl) walk(n.children, c);
          else Warn(`${n.name}: ${n.class} alt bileşen içeremez`);
        }
      }
    };
    walk(root.children, Form);
    for (const [c, pi, v] of refs) {
      try {
        SetPropValue(c, pi, v, (nm) => map.get(nm) ?? null);
      } catch (e) {
        Warn(`${c.Name}.${pi.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } finally {
    Form.EndLoading();
  }
  return map;
}

/** Serialises one component (non-default published properties only). */
export function SaveComponentNode(Comp: TComponent, Events: Record<string, string> = {}): TDesignNode {
  const info = GetClassInfo(RegisteredClassOf(Comp));
  const props: Record<string, unknown> = {};
  for (const pi of info?.props ?? []) {
    if (pi.stored === false || pi.readOnly) continue;
    const v = GetPropValue(Comp, pi);
    if (!IsDefaultPropValue(pi, v)) props[pi.name] = v;
  }
  const node: TDesignNode = { class: RegisteredClassOf(Comp), name: Comp.Name, props };
  if (Object.keys(Events).length) node.events = { ...Events };
  if (Comp instanceof TWinControl && Comp.ControlCount) {
    node.children = Comp.Controls.map((c) => SaveComponentNode(c));
  }
  return node;
}

/** Serialises a whole form (TWriter equivalent). Non-visual components follow the controls. */
export function SaveDesign(Form: TCustomForm): TDesignDocument {
  const root = SaveComponentNode(Form);
  const nonVisual = Form.Components.filter((c) => !(c instanceof TControl)).map((c) => SaveComponentNode(c));
  root.children = [...(root.children ?? []), ...nonVisual];
  return { format: 'jsd-design', version: 1, form: root };
}

/* ================================================================= RTTI == */

function P(name: string, kind: TPropKind, category: TPropCategory, def?: unknown, hint?: string, extra: Partial<TPropInfo> = {}): TPropInfo {
  return { name, kind, category, default: def, hint, ...extra };
}

function EV(name: string, params: string, hint: string): TEventInfo {
  // Stubs are always `function (Sender, e)`; notify events declare an optional `e` so they type-check.
  return { name, params: params.includes(',') ? params : `${params}, e?: undefined`, hint };
}

export const EnumTypes: Record<string, readonly string[]> = {
  TAlign: ['alNone', 'alTop', 'alBottom', 'alLeft', 'alRight', 'alClient'],
  TAnchorKind: ['akLeft', 'akTop', 'akRight', 'akBottom'],
  TAlignment: ['taLeftJustify', 'taRightJustify', 'taCenter'],
  TLeftRight: ['taLeftJustify', 'taRightJustify'],
  TTextLayout: ['tlTop', 'tlCenter', 'tlBottom'],
  TBevelCut: ['bvNone', 'bvLowered', 'bvRaised', 'bvSpace'],
  TBorderStyle: ['bsNone', 'bsSingle'],
  TFormBorderStyle: ['bsNone', 'bsSingle', 'bsSizeable', 'bsDialog', 'bsToolWindow', 'bsSizeToolWin'],
  TBorderIcon: ['biSystemMenu', 'biMinimize', 'biMaximize', 'biHelp'],
  TPosition: ['poDesigned', 'poDefault', 'poScreenCenter', 'poMainFormCenter', 'poOwnerFormCenter'],
  TWindowState: ['wsNormal', 'wsMinimized', 'wsMaximized'],
  TScrollStyle: ['ssNone', 'ssHorizontal', 'ssVertical', 'ssBoth'],
  TEditCharCase: ['ecNormal', 'ecUpperCase', 'ecLowerCase'],
  TComboBoxStyle: ['csDropDown', 'csDropDownList'],
  TCheckBoxState: ['cbUnchecked', 'cbChecked', 'cbGrayed'],
  TProgressBarOrientation: ['pbHorizontal', 'pbVertical'],
  TProgressBarState: ['pbsNormal', 'pbsError', 'pbsPaused'],
  TTabPosition: ['tpTop', 'tpBottom'],
  TCursor: Object.keys(CURSORS),
  TGridOption: ['dgTitles', 'dgIndicator', 'dgColLines', 'dgRowLines', 'dgRowSelect', 'dgAlwaysShowSelection', 'dgEditing', 'dgStriped'],
  TNavigateBtn: ALL_NAV_BUTTONS,
  TFontStyle: ['fsBold', 'fsItalic', 'fsUnderline', 'fsStrikeOut'],
  TFieldType: ['ftUnknown', 'ftString', 'ftInteger', 'ftFloat', 'ftCurrency', 'ftBoolean', 'ftDate', 'ftDateTime', 'ftTime', 'ftMemo', 'ftBlob'],
};

const E = EnumTypes;
const FONT_PROPS = [
  P('Font', 'font', 'Visual', undefined, 'Yazı tipi: ad, punto, renk ve stil (kalın, italik…).'),
  P('ParentFont', 'bool', 'Visual', true, 'True ise yazı tipi üst kontrolden alınır; Font değişince False olur.'),
];
const colorProps = (def: TColor, parentDef: boolean): TPropInfo[] => [
  P('Color', 'color', 'Visual', def, 'Arka plan rengi (clBtnFace, clWindow, #RRGGBB …).'),
  P('ParentColor', 'bool', 'Visual', parentDef, 'True ise arka plan rengi üst kontrolden alınır.'),
];
const CAPTION = P('Caption', 'text', 'Visual', '', 'Kontrol üzerinde görünen metin. "&" sonraki harfi kısayol (Alt+harf) yapar.', { live: true });

const MOUSE = 'Sender: $Self, e: TMouseEventArgs';
const CONTROL_EVENTS: TEventInfo[] = [
  EV('OnClick', 'Sender: $Self, e?: MouseEvent', 'Kontrole tıklandığında.'),
  EV('OnDblClick', 'Sender: $Self, e?: MouseEvent', 'Kontrole çift tıklandığında.'),
  EV('OnMouseDown', MOUSE, 'Fare düğmesine basıldığında (Button, Shift, X, Y).'),
  EV('OnMouseUp', MOUSE, 'Fare düğmesi bırakıldığında.'),
  EV('OnMouseMove', MOUSE, 'Fare kontrol üzerinde hareket ettiğinde.'),
  EV('OnMouseEnter', 'Sender: $Self, e?: MouseEvent', 'Fare kontrolün üzerine geldiğinde.'),
  EV('OnMouseLeave', 'Sender: $Self, e?: MouseEvent', 'Fare kontrolün üzerinden ayrıldığında.'),
  EV('OnResize', 'Sender: $Self', 'Kontrolün boyutu değiştiğinde.'),
];
const WIN_EVENTS: TEventInfo[] = [
  EV('OnEnter', 'Sender: $Self', 'Kontrol odağı aldığında.'),
  EV('OnExit', 'Sender: $Self', 'Kontrol odağı kaybettiğinde.'),
  EV('OnKeyDown', 'Sender: $Self, e: TKeyEventArgs', 'Bir tuşa basıldığında (e.Key, e.Shift; e.Handled = true ile tuşu yut).'),
  EV('OnKeyPress', 'Sender: $Self, e: TKeyPressEventArgs', 'Karakter yazıldığında (e.Key = "" ile iptal edilir).'),
  EV('OnKeyUp', 'Sender: $Self, e: TKeyEventArgs', 'Tuş bırakıldığında.'),
];
const DATASET_EVENTS: TEventInfo[] = [
  ['BeforeOpen', 'Veri kümesi açılmadan önce.'], ['AfterOpen', 'Veri kümesi açıldıktan sonra (kayıtlar yüklendi).'],
  ['BeforeClose', 'Kapatılmadan önce.'], ['AfterClose', 'Kapatıldıktan sonra.'],
  ['BeforeInsert', 'Yeni kayıt eklenmeden önce.'], ['AfterInsert', 'Yeni kayıt eklendikten sonra.'],
  ['BeforeEdit', 'Düzenleme moduna geçmeden önce.'], ['AfterEdit', 'Düzenleme moduna geçtikten sonra.'],
  ['BeforePost', 'Kayıt kaydedilmeden önce (doğrulama için ideal).'], ['AfterPost', 'Kayıt sunucuya yazıldıktan sonra.'],
  ['BeforeCancel', 'Değişiklikler iptal edilmeden önce.'], ['AfterCancel', 'Değişiklikler iptal edildikten sonra.'],
  ['BeforeDelete', 'Kayıt silinmeden önce.'], ['AfterDelete', 'Kayıt silindikten sonra.'],
  ['BeforeScroll', 'Kayıt imleci hareket etmeden önce.'], ['AfterScroll', 'Kayıt imleci hareket ettikten sonra.'],
  ['OnNewRecord', 'Yeni kayda varsayılan değer atamak için.'],
].map(([n, h]) => EV(n, 'Sender: $Self', h)).concat([EV('OnPostError', 'Sender: $Self, e: { Error: Error }', 'Post sunucu tarafından reddedildiğinde.')]);

function reg(cls: TComponentClass, info: Omit<TComponentInfo, 'visual' | 'container' | 'props' | 'events'> & Partial<Pick<TComponentInfo, 'visual' | 'container' | 'props' | 'events'>>): void {
  RegisterClass(cls, { visual: false, container: false, props: [], events: [], ...info });
}

reg(TComponent, {
  name: 'TComponent', parent: null, abstract: true,
  props: [
    P('Name', 'string', 'Misc', '', 'Bileşenin koddaki adı (tanımlayıcı). Form içinde benzersiz olmalıdır.', { stored: false }),
    P('Tag', 'int', 'Misc', 0, 'Kullanıcı verisi için serbest tamsayı.'),
    P('DesignLeft', 'int', 'Layout', 0, 'Görsel olmayan bileşenin tasarımcıdaki X konumu.', { hidden: true, designOnly: true }),
    P('DesignTop', 'int', 'Layout', 0, 'Görsel olmayan bileşenin tasarımcıdaki Y konumu.', { hidden: true, designOnly: true }),
  ],
});

reg(TControl, {
  name: 'TControl', parent: 'TComponent', abstract: true, visual: true, hide: ['DesignLeft', 'DesignTop'],
  props: [
    P('Left', 'int', 'Layout', 0, 'Üst kontrolün istemci alanına göre X konumu (piksel).'),
    P('Top', 'int', 'Layout', 0, 'Üst kontrolün istemci alanına göre Y konumu (piksel).'),
    P('Width', 'int', 'Layout', undefined, 'Genişlik (piksel).', { min: 0 }),
    P('Height', 'int', 'Layout', undefined, 'Yükseklik (piksel).', { min: 0 }),
    P('Align', 'enum', 'Layout', 'alNone', 'Üst kontrole yaslanma: alTop, alBottom, alLeft, alRight, alClient.', { values: E.TAlign }),
    P('Anchors', 'set', 'Layout', ['akLeft', 'akTop'], 'Üst kontrol boyutlanınca korunacak kenar mesafeleri.', { values: E.TAnchorKind }),
    P('Visible', 'bool', 'Behavior', true, 'Çalışma zamanında görünür mü? (Tasarımda her zaman çizilir.)'),
    P('Enabled', 'bool', 'Behavior', true, 'Kullanıcı etkileşimine açık mı?'),
    P('Cursor', 'cursor', 'Behavior', 'crDefault', 'Fare imleci şekli.', { values: E.TCursor }),
    P('Hint', 'string', 'Help', '', 'Fare üzerine gelince gösterilecek ipucu metni.'),
    P('ShowHint', 'bool', 'Help', false, 'Hint metni gösterilsin mi?'),
  ],
  events: CONTROL_EVENTS,
  defaultEvent: 'OnClick',
});

reg(TGraphicControl, { name: 'TGraphicControl', parent: 'TControl', abstract: true, visual: true });

reg(TWinControl, {
  name: 'TWinControl', parent: 'TControl', abstract: true, visual: true,
  props: [
    P('TabOrder', 'int', 'Behavior', -1, 'Tab tuşuyla dolaşma sırası.'),
    P('TabStop', 'bool', 'Behavior', true, 'Tab tuşuyla odaklanabilir mi?'),
  ],
  events: WIN_EVENTS,
});

reg(TLabel, {
  name: 'TLabel', parent: 'TGraphicControl', palette: 'Standard', visual: true,
  hint: 'Sabit metin etiketi. Odak almaz; FocusControl ile bir kontrole kısayol verir.',
  defaultSize: { w: 65, h: 15 },
  props: [
    CAPTION,
    P('AutoSize', 'bool', 'Visual', true, 'Boyut metne göre otomatik ayarlansın.'),
    P('Alignment', 'enum', 'Visual', 'taLeftJustify', 'Yatay metin hizası.', { values: E.TAlignment }),
    P('Layout', 'enum', 'Visual', 'tlTop', 'Dikey metin hizası.', { values: E.TTextLayout }),
    P('WordWrap', 'bool', 'Visual', false, 'Uzun metin satırlara bölünsün.'),
    P('Transparent', 'bool', 'Visual', true, 'Arka plan saydam olsun.'),
    P('ShowAccelChar', 'bool', 'Visual', true, '"&" karakteri kısayol olarak yorumlansın.'),
    P('FocusControl', 'component', 'Behavior', undefined, 'Alt+kısayol ile odaklanacak kontrol.', { refClass: 'TWinControl' }),
    ...colorProps('clBtnFace', true),
    ...FONT_PROPS,
  ],
});

reg(TButton, {
  name: 'TButton', parent: 'TWinControl', palette: 'Standard', visual: true,
  hint: 'Komut düğmesi. ModalResult değeri modal formu kapatır.',
  defaultSize: { w: 75, h: 25 },
  props: [
    CAPTION,
    P('Default', 'bool', 'Behavior', false, 'Enter tuşu bu düğmeyi tetikler.'),
    P('Cancel', 'bool', 'Behavior', false, 'Esc tuşu bu düğmeyi tetikler.'),
    P('ModalResult', 'modalresult', 'Behavior', 0, 'Modal formda tıklanınca formu bu sonuçla kapatır (mrOk, mrCancel…).', { values: Object.keys(ModalResultNames) }),
    P('WordWrap', 'bool', 'Visual', false, 'Başlık birden çok satıra bölünebilsin.'),
    ...FONT_PROPS,
  ],
});

reg(TEdit, {
  name: 'TEdit', parent: 'TWinControl', palette: 'Standard', visual: true,
  hint: 'Tek satırlık metin giriş kutusu.',
  defaultEvent: 'OnChange', defaultSize: { w: 121, h: 23 },
  props: [
    P('Text', 'text', 'Visual', '', 'Kutudaki metin.', { live: true }),
    P('TextHint', 'string', 'Help', '', 'Kutu boşken gösterilecek soluk ipucu (placeholder).'),
    P('MaxLength', 'int', 'Behavior', 0, 'En fazla karakter sayısı (0 = sınırsız).', { min: 0 }),
    P('PasswordChar', 'string', 'Behavior', '', 'Doluysa girilen metin gizlenir (parola alanı).'),
    P('ReadOnly', 'bool', 'Behavior', false, 'Salt okunur.'),
    P('CharCase', 'enum', 'Behavior', 'ecNormal', 'Harfleri otomatik büyük/küçük yap.', { values: E.TEditCharCase }),
    P('NumbersOnly', 'bool', 'Input', false, 'Yalnızca rakam girilebilsin.'),
    P('AutoSelect', 'bool', 'Behavior', true, 'Odaklanınca tüm metin seçilsin.'),
    P('Alignment', 'enum', 'Visual', 'taLeftJustify', 'Metin hizası.', { values: E.TAlignment }),
    P('BorderStyle', 'enum', 'Visual', 'bsSingle', 'Kenarlık.', { values: E.TBorderStyle }),
    ...colorProps('clWindow', false),
    ...FONT_PROPS,
  ],
  events: [EV('OnChange', 'Sender: $Self, e?: Event', 'Metin değiştiğinde (kullanıcı veya kod).')],
});

reg(TMemo, {
  name: 'TMemo', parent: 'TWinControl', palette: 'Standard', visual: true,
  hint: 'Çok satırlı metin düzenleyici (Lines: TStrings).',
  defaultEvent: 'OnChange', defaultSize: { w: 185, h: 89 },
  props: [
    P('Lines', 'strings', 'Visual', undefined, 'Metin satırları (TStrings).'),
    P('ScrollBars', 'enum', 'Visual', 'ssVertical', 'Kaydırma çubukları.', { values: E.TScrollStyle }),
    P('WordWrap', 'bool', 'Visual', true, 'Satır kaydırma.'),
    P('ReadOnly', 'bool', 'Behavior', false, 'Salt okunur.'),
    P('MaxLength', 'int', 'Behavior', 0, 'En fazla karakter (0 = sınırsız).', { min: 0 }),
    P('Alignment', 'enum', 'Visual', 'taLeftJustify', 'Metin hizası.', { values: E.TAlignment }),
    P('WantTabs', 'bool', 'Input', false, 'Tab tuşu metne sekme ekler.'),
    ...colorProps('clWindow', false),
    ...FONT_PROPS,
  ],
  events: [EV('OnChange', 'Sender: $Self', 'İçerik değiştiğinde.')],
});

reg(TComboBox, {
  name: 'TComboBox', parent: 'TWinControl', palette: 'Standard', visual: true,
  hint: 'Açılır liste. csDropDownList stilinde yalnızca listeden seçim yapılır.',
  defaultEvent: 'OnChange', defaultSize: { w: 145, h: 23 },
  props: [
    P('Style', 'enum', 'Behavior', 'csDropDown', 'csDropDown: yazılabilir, csDropDownList: yalnız seçim.', { values: E.TComboBoxStyle }),
    P('Items', 'strings', 'Data', undefined, 'Liste öğeleri.'),
    P('ItemIndex', 'int', 'Data', -1, 'Seçili öğenin sırası (-1 = seçim yok).'),
    P('Text', 'text', 'Visual', '', 'Görünen metin.', { live: true }),
    P('Sorted', 'bool', 'Behavior', false, 'Öğeler alfabetik sıralansın.'),
    P('DropDownCount', 'int', 'Behavior', 8, 'Açılır listede görünen satır sayısı.', { min: 1, max: 50 }),
    P('TextHint', 'string', 'Help', '', 'Boşken gösterilen ipucu.'),
    ...colorProps('clWindow', false),
    ...FONT_PROPS,
  ],
  events: [
    EV('OnChange', 'Sender: $Self', 'Seçim veya metin değiştiğinde.'),
    EV('OnSelect', 'Sender: $Self', 'Listeden öğe seçildiğinde.'),
    EV('OnDropDown', 'Sender: $Self', 'Liste açılmadan önce.'),
    EV('OnCloseUp', 'Sender: $Self', 'Liste kapandığında.'),
  ],
});

reg(TButtonControl as unknown as TComponentClass, { name: 'TButtonControl', parent: 'TWinControl', abstract: true, visual: true });

reg(TCheckBox, {
  name: 'TCheckBox', parent: 'TButtonControl', palette: 'Standard', visual: true,
  hint: 'Onay kutusu. Checked değişince OnClick tetiklenir.',
  defaultSize: { w: 97, h: 17 },
  props: [
    CAPTION,
    P('Checked', 'bool', 'Visual', false, 'İşaretli mi?'),
    P('State', 'enum', 'Visual', 'cbUnchecked', 'Üç durumlu değer (AllowGrayed ile cbGrayed).', { values: E.TCheckBoxState, stored: false }),
    P('AllowGrayed', 'bool', 'Behavior', false, 'Üçüncü (belirsiz) durum kullanılabilsin.'),
    P('Alignment', 'enum', 'Visual', 'taRightJustify', 'Metin kutunun sağında (taRightJustify) veya solunda.', { values: E.TLeftRight }),
    P('WordWrap', 'bool', 'Visual', false, 'Başlık satırlara bölünsün.'),
    ...colorProps('clBtnFace', true),
    ...FONT_PROPS,
  ],
});

reg(TRadioButton, {
  name: 'TRadioButton', parent: 'TButtonControl', palette: 'Standard', visual: true,
  hint: 'Seçenek düğmesi. Aynı üst kontroldeki diğer seçeneklerle karşılıklı dışlayıcıdır.',
  defaultSize: { w: 113, h: 17 },
  props: [
    CAPTION,
    P('Checked', 'bool', 'Visual', false, 'Seçili mi?'),
    P('Alignment', 'enum', 'Visual', 'taRightJustify', 'Metin konumu.', { values: E.TLeftRight }),
    P('WordWrap', 'bool', 'Visual', false, 'Başlık satırlara bölünsün.'),
    ...colorProps('clBtnFace', true),
    ...FONT_PROPS,
  ],
});

reg(TImage, {
  name: 'TImage', parent: 'TGraphicControl', palette: 'Additional', visual: true,
  hint: 'Resim gösterir (proje varlığı, URL veya data: URI).',
  defaultSize: { w: 105, h: 105 },
  props: [
    P('Picture', 'image', 'Visual', '', 'Resim kaynağı: assets/logo.png, https://… veya data:image/…'),
    P('Stretch', 'bool', 'Visual', false, 'Resmi kontrol boyutuna uydur.'),
    P('Proportional', 'bool', 'Visual', false, 'Uydururken en-boy oranını koru.'),
    P('Center', 'bool', 'Visual', false, 'Resmi ortala.'),
  ],
});

reg(TProgressBar, {
  name: 'TProgressBar', parent: 'TWinControl', palette: 'Additional', visual: true,
  hint: 'İlerleme çubuğu. StepIt/StepBy ile ilerletilir.',
  defaultSize: { w: 150, h: 17 },
  props: [
    P('Min', 'int', 'Behavior', 0, 'En küçük değer.'),
    P('Max', 'int', 'Behavior', 100, 'En büyük değer.'),
    P('Position', 'int', 'Behavior', 0, 'Geçerli değer.'),
    P('Step', 'int', 'Behavior', 10, 'StepIt artış miktarı.'),
    P('Orientation', 'enum', 'Visual', 'pbHorizontal', 'Yatay veya dikey.', { values: E.TProgressBarOrientation }),
    P('State', 'enum', 'Visual', 'pbsNormal', 'Normal, hata (kırmızı) veya duraklatılmış (sarı).', { values: E.TProgressBarState }),
    P('Marquee', 'bool', 'Visual', false, 'Belirsiz süreli (kayan) animasyon.'),
  ],
});

reg(TPanel, {
  name: 'TPanel', parent: 'TWinControl', palette: 'Standard', visual: true, container: true,
  hint: 'Kabartmalı kap. Align ile form düzeni kurmak için idealdir.',
  defaultSize: { w: 185, h: 41 },
  props: [
    CAPTION,
    P('Alignment', 'enum', 'Visual', 'taCenter', 'Başlığın yatay hizası.', { values: E.TAlignment }),
    P('VerticalAlignment', 'enum', 'Visual', 'tlCenter', 'Başlığın dikey hizası.', { values: E.TTextLayout }),
    P('BevelOuter', 'enum', 'Visual', 'bvRaised', 'Dış kabartma.', { values: E.TBevelCut }),
    P('BevelInner', 'enum', 'Visual', 'bvNone', 'İç kabartma.', { values: E.TBevelCut }),
    P('BevelWidth', 'int', 'Visual', 1, 'Kabartma kalınlığı.', { min: 1, max: 20 }),
    P('BorderStyle', 'enum', 'Visual', 'bsNone', 'İnce çerçeve.', { values: E.TBorderStyle }),
    P('ShowCaption', 'bool', 'Visual', true, 'Başlık gösterilsin.'),
    ...colorProps('clBtnFace', false),
    ...FONT_PROPS,
  ],
});

reg(TGroupBox, {
  name: 'TGroupBox', parent: 'TWinControl', palette: 'Standard', visual: true, container: true,
  hint: 'Başlıklı çerçeve; ilgili kontrolleri gruplar (seçenek düğmeleri için ideal).',
  defaultSize: { w: 185, h: 105 },
  props: [CAPTION, ...colorProps('clBtnFace', true), ...FONT_PROPS],
});

reg(TTabControl, {
  name: 'TTabControl', parent: 'TWinControl', palette: 'Additional', visual: true, container: true,
  hint: 'Sekme şeridi ve tek istemci alanı. İçerik OnChange içinde değiştirilir.',
  defaultEvent: 'OnChange', defaultSize: { w: 289, h: 193 },
  props: [
    P('Tabs', 'strings', 'Visual', undefined, 'Sekme başlıkları.'),
    P('TabIndex', 'int', 'Visual', -1, 'Etkin sekme (-1 = yok).'),
    P('TabPosition', 'enum', 'Visual', 'tpTop', 'Sekmelerin konumu.', { values: E.TTabPosition }),
    ...FONT_PROPS,
  ],
  events: [
    EV('OnChange', 'Sender: $Self', 'Etkin sekme değiştiğinde.'),
    EV('OnChanging', 'Sender: $Self, e: TTabChangingEventArgs', 'Sekme değişmeden önce (e.AllowChange = false ile engellenir).'),
  ],
});

reg(TScrollBox, {
  name: 'TScrollBox', parent: 'TWinControl', palette: 'Additional', visual: true, container: true,
  hint: 'Kaydırılabilir kap; içerik taşarsa kaydırma çubukları çıkar.',
  defaultSize: { w: 185, h: 121 },
  props: [
    P('BorderStyle', 'enum', 'Visual', 'bsSingle', 'Çerçeve.', { values: E.TBorderStyle }),
    P('AutoScroll', 'bool', 'Behavior', true, 'Gerektiğinde kaydırma çubukları göster.'),
    ...colorProps('clBtnFace', true),
    ...FONT_PROPS,
  ],
});

reg(TTimer, {
  name: 'TTimer', parent: 'TComponent', palette: 'System',
  hint: 'Belirli aralıklarla OnTimer tetikler. Tasarım anında çalışmaz.',
  defaultEvent: 'OnTimer',
  props: [
    P('Enabled', 'bool', 'Behavior', true, 'Zamanlayıcı çalışsın mı?'),
    P('Interval', 'int', 'Behavior', 1000, 'Tetikleme aralığı (milisaniye).', { min: 0 }),
  ],
  events: [EV('OnTimer', 'Sender: $Self', 'Her Interval milisaniyede bir.')],
});

reg(TCustomForm, { name: 'TCustomForm', parent: 'TWinControl', abstract: true, visual: true, container: true });

reg(TForm, {
  name: 'TForm', parent: 'TCustomForm', palette: 'Forms', visual: true, container: true,
  hint: 'Uygulama penceresi. Tasarımcı ve çalışan uygulama aynı TForm sınıfını kullanır (WYSIWYG).',
  defaultEvent: 'OnCreate',
  hide: ['Width', 'Height', 'Align', 'Anchors', 'Visible', 'TabOrder', 'TabStop', 'ParentColor', 'ParentFont', 'OnEnter', 'OnExit'],
  props: [
    CAPTION,
    P('ClientWidth', 'int', 'Layout', 624, 'İstemci alanı genişliği (çerçeve hariç).', { min: 80 }),
    P('ClientHeight', 'int', 'Layout', 441, 'İstemci alanı yüksekliği (başlık çubuğu hariç).', { min: 40 }),
    P('Position', 'enum', 'Layout', 'poScreenCenter', 'İlk gösterimde pencere konumu.', { values: E.TPosition }),
    P('BorderStyle', 'enum', 'Visual', 'bsSizeable', 'Pencere çerçevesi.', { values: E.TFormBorderStyle }),
    P('BorderIcons', 'set', 'Visual', ['biSystemMenu', 'biMinimize', 'biMaximize'], 'Başlık çubuğu düğmeleri.', { values: E.TBorderIcon }),
    P('WindowState', 'enum', 'Visual', 'wsNormal', 'Normal, simge veya tam ekran.', { values: E.TWindowState }),
    P('KeyPreview', 'bool', 'Input', false, 'Tuş olaylarını önce form alsın.'),
    P('ActiveControl', 'component', 'Behavior', undefined, 'Form açılınca odaklanacak kontrol.', { refClass: 'TWinControl' }),
    P('Color', 'color', 'Visual', 'clBtnFace', 'İstemci alanı rengi.'),
    P('Font', 'font', 'Visual', undefined, 'Form ve (ParentFont) alt kontrollerin yazı tipi.'),
  ],
  events: [
    EV('OnCreate', 'Sender: $Self', 'Form oluşturulup bileşenler yüklendikten sonra.'),
    EV('OnShow', 'Sender: $Self', 'Form gösterildiğinde.'),
    EV('OnHide', 'Sender: $Self', 'Form gizlendiğinde.'),
    EV('OnClose', 'Sender: $Self, e: TCloseEventArgs', 'Form kapanırken (e.Action: caHide, caFree, caNone…).'),
    EV('OnCloseQuery', 'Sender: $Self, e: TCloseQueryEventArgs', 'Kapanmadan önce (e.CanClose = false ile engellenir).'),
    EV('OnActivate', 'Sender: $Self', 'Form etkin pencere olduğunda.'),
    EV('OnDeactivate', 'Sender: $Self', 'Form etkinliğini kaybettiğinde.'),
    EV('OnDestroy', 'Sender: $Self', 'Form yok edilirken.'),
  ],
});

reg(TConnection, {
  name: 'TConnection', parent: 'TComponent', palette: 'Data Access',
  hint: 'Sunucudaki şifreli bağlantı tanımına adıyla bağlanır. Parola/bağlantı dizesi tarayıcıya asla gelmez.',
  defaultEvent: 'AfterConnect',
  props: [
    P('ConnectionDefName', 'connection', 'Database', '', 'Sunucu tarafı bağlantı tanımının adı (Veritabanı ▸ Bağlantılar).'),
    P('Connected', 'bool', 'Database', false, 'Bağlantı etkin mi?'),
    P('LoginPrompt', 'bool', 'Database', false, 'Oturum açma istemi (web ortamında kullanılmaz).'),
  ],
  events: [
    EV('BeforeConnect', 'Sender: $Self', 'Bağlanmadan önce.'),
    EV('AfterConnect', 'Sender: $Self', 'Bağlandıktan sonra.'),
    EV('AfterDisconnect', 'Sender: $Self', 'Bağlantı kapandıktan sonra.'),
  ],
});

reg(TDataSource, {
  name: 'TDataSource', parent: 'TComponent', palette: 'Data Access',
  hint: 'Veri kümesini (TQuery/TTable) veri-duyarlı kontrollere (TDBGrid…) bağlar.',
  defaultEvent: 'OnDataChange',
  props: [
    P('DataSet', 'component', 'Data', undefined, 'Bağlı veri kümesi.', { refClass: 'TDataSet' }),
    P('AutoEdit', 'bool', 'Data', true, 'Kontrolde yazınca otomatik Edit moduna geç.'),
    P('Enabled', 'bool', 'Behavior', true, 'Bağlı kontroller güncellensin mi?'),
  ],
  events: [
    EV('OnDataChange', 'Sender: $Self, e: { Field: TField | null }', 'Kayıt veya alan değiştiğinde.'),
    EV('OnStateChange', 'Sender: $Self', 'Veri kümesi durumu (dsBrowse/dsEdit…) değiştiğinde.'),
  ],
});

reg(TDataSet as unknown as TComponentClass, {
  name: 'TDataSet', parent: 'TComponent', abstract: true,
  props: [
    P('Connection', 'component', 'Database', undefined, 'Kullanılacak TConnection.', { refClass: 'TConnection' }),
    P('Active', 'bool', 'Database', false, 'True: veri kümesi açılır. Tasarım anında canlı veri gösterir.'),
    P('MaxRows', 'int', 'Database', 500, 'Sunucudan alınacak en fazla satır.', { min: 1, max: 5000 }),
  ],
  events: DATASET_EVENTS,
  defaultEvent: 'AfterOpen',
});

reg(TQuery, {
  name: 'TQuery', parent: 'TDataSet', palette: 'Data Access',
  hint: 'Parametreli SQL sorgusu. Değerler :ad parametreleriyle sunucuda bağlanır (SQL injection yok).',
  props: [
    P('SQL', 'sql', 'Database', undefined, 'SQL metni. Değerler için :parametre kullanın; birleştirme yapmayın.'),
    P('Params', 'params', 'Database', undefined, 'SQL parametreleri (tip ve değer).'),
    P('ParamCheck', 'bool', 'Database', true, 'SQL değişince parametre listesi yeniden oluşturulsun.'),
  ],
});

reg(TTable, {
  name: 'TTable', parent: 'TDataSet', palette: 'Data Access',
  hint: 'Tablonun tamamı üzerinde gezinme ve düzenleme (birincil anahtar gerekir).',
  props: [
    P('TableName', 'table', 'Database', '', 'Tablo adı (şemadan seçilir).'),
    P('FieldList', 'fieldlist', 'Database', '', 'Getirilecek kolonlar (; ile). Boş = tümü.'),
    P('IndexFieldNames', 'fieldlist', 'Database', '', 'Sıralama kolonları (; ile, azalan için -kolon).'),
    P('ReadOnly', 'bool', 'Database', false, 'Salt okunur.'),
    P('MasterSource', 'component', 'Database', undefined, 'Ana-detay için ana veri kaynağı.', { refClass: 'TDataSource' }),
    P('MasterFields', 'string', 'Database', '', 'Ana-detay eşleşmesi: detay_kolon=ana_kolon;…'),
  ],
});

reg(TStoredProc, {
  name: 'TStoredProc', parent: 'TDataSet', palette: 'Data Access',
  hint: 'Saklı yordam/fonksiyon çağrısı; sonuç satırları veri kümesi olur.',
  props: [
    P('StoredProcName', 'procname', 'Database', '', 'Yordam adı (şemadan seçilir).'),
    P('Params', 'params', 'Database', undefined, 'Yordam parametreleri.'),
  ],
});

reg(TDBGrid, {
  name: 'TDBGrid', parent: 'TWinControl', palette: 'Data Controls', visual: true,
  hint: 'Veri kümesini tablo olarak gösterir ve düzenletir. Tasarım anında canlı veri önizler.',
  defaultEvent: 'OnCellClick', defaultSize: { w: 320, h: 120 },
  props: [
    P('DataSource', 'component', 'Data', undefined, 'Bağlı TDataSource.', { refClass: 'TDataSource' }),
    P('Columns', 'columns', 'Data', undefined, 'Kolon eşleştirme: alan, başlık, genişlik, hiza.'),
    P('Options', 'set', 'Behavior', ['dgTitles', 'dgIndicator', 'dgColLines', 'dgRowLines', 'dgStriped', 'dgEditing'], 'Izgara seçenekleri.', { values: E.TGridOption }),
    P('ReadOnly', 'bool', 'Behavior', false, 'Hücre düzenlemeyi kapat.'),
    P('DefaultRowHeight', 'int', 'Visual', 24, 'Satır yüksekliği.', { min: 16, max: 80 }),
    ...colorProps('clWindow', false),
    ...FONT_PROPS,
  ],
  events: [
    EV('OnCellClick', 'Sender: $Self, e: TGridCellEventArgs', 'Hücreye tıklandığında.'),
    EV('OnTitleClick', 'Sender: $Self, e: { Column: TGridColumnJSON }', 'Kolon başlığına tıklandığında.'),
  ],
});

reg(TDBNavigator, {
  name: 'TDBNavigator', parent: 'TWinControl', palette: 'Data Controls', visual: true,
  hint: 'Kayıtlar arasında gezinme ve Ekle/Sil/Kaydet düğmeleri.',
  defaultSize: { w: 240, h: 25 },
  props: [
    P('DataSource', 'component', 'Data', undefined, 'Bağlı TDataSource.', { refClass: 'TDataSource' }),
    P('VisibleButtons', 'set', 'Visual', ALL_NAV_BUTTONS.slice(), 'Görünen düğmeler.', { values: E.TNavigateBtn }),
    P('ConfirmDelete', 'bool', 'Behavior', true, 'Silmeden önce onay iste.'),
  ],
  events: [EV('OnClick', 'Sender: $Self, e: { Button: TNavigateBtn }', 'Bir gezinme düğmesine basıldıktan sonra.')],
});

reg(TDBEdit, {
  name: 'TDBEdit', parent: 'TEdit', palette: 'Data Controls', visual: true,
  hint: 'Geçerli kaydın bir alanını gösteren/düzenleten metin kutusu.',
  hide: ['Text'],
  props: [
    P('DataSource', 'component', 'Data', undefined, 'Bağlı TDataSource.', { refClass: 'TDataSource' }),
    P('DataField', 'datafield', 'Data', '', 'Gösterilecek alan.'),
  ],
});

/* ============================================================= manifest == */

export const PaletteOrder: readonly string[] = ['Forms', 'Standard', 'Additional', 'System', 'Data Access', 'Data Controls'];

export const CategoryLabels: Record<TPropCategory, string> = {
  Layout: 'Düzen', Visual: 'Görünüm', Behavior: 'Davranış', Input: 'Giriş', Data: 'Veri',
  Database: 'Veritabanı', Help: 'Yardım ve İpuçları', Misc: 'Diğer',
};

export interface TRuntimeManifest {
  format: 'jsd-vcl-manifest';
  version: string;
  palette: readonly string[];
  classes: TMergedComponentInfo[];
  enums: Record<string, readonly string[]>;
  colors: readonly string[];
  fonts: readonly string[];
  modalResults: Record<string, number>;
}

/** Machine readable RTTI used by the IDE (palette/inspector) and the BuildService (validation). */
export function GetRuntimeManifest(): TRuntimeManifest {
  return {
    format: 'jsd-vcl-manifest',
    version: VCL_VERSION,
    palette: PaletteOrder,
    classes: GetRegisteredClassNames().map((n) => GetClassInfo(n)!).filter(Boolean),
    enums: EnumTypes,
    colors: ColorNames,
    fonts: FontNames,
    modalResults: ModalResultNames,
  };
}
