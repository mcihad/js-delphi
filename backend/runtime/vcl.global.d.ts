/* JS-Delphi VCL runtime — generated from vcl.ts (sha256 5eb725ff14a6acfe). Do not edit. */
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
declare const VCL_VERSION = "1.0.0";
type TAlign = 'alNone' | 'alTop' | 'alBottom' | 'alLeft' | 'alRight' | 'alClient';
type TAnchorKind = 'akLeft' | 'akTop' | 'akRight' | 'akBottom';
type TAnchors = TAnchorKind[];
type TFontStyle = 'fsBold' | 'fsItalic' | 'fsUnderline' | 'fsStrikeOut';
type TColor = string;
type TCursor = 'crDefault' | 'crArrow' | 'crHandPoint' | 'crIBeam' | 'crCross' | 'crHourGlass' | 'crNo' | 'crSizeAll' | 'crSizeWE' | 'crSizeNS' | 'crHelp' | 'crDrag';
type TAlignment = 'taLeftJustify' | 'taRightJustify' | 'taCenter';
type TTextLayout = 'tlTop' | 'tlCenter' | 'tlBottom';
type TBevelCut = 'bvNone' | 'bvLowered' | 'bvRaised' | 'bvSpace';
type TBorderStyle = 'bsNone' | 'bsSingle';
type TFormBorderStyle = 'bsNone' | 'bsSingle' | 'bsSizeable' | 'bsDialog' | 'bsToolWindow' | 'bsSizeToolWin';
type TBorderIcon = 'biSystemMenu' | 'biMinimize' | 'biMaximize' | 'biHelp';
type TPosition = 'poDesigned' | 'poDefault' | 'poScreenCenter' | 'poMainFormCenter' | 'poOwnerFormCenter';
type TWindowState = 'wsNormal' | 'wsMinimized' | 'wsMaximized';
type TCloseAction = 'caNone' | 'caHide' | 'caFree' | 'caMinimize';
type TScrollStyle = 'ssNone' | 'ssHorizontal' | 'ssVertical' | 'ssBoth';
type TEditCharCase = 'ecNormal' | 'ecUpperCase' | 'ecLowerCase';
type TComboBoxStyle = 'csDropDown' | 'csDropDownList';
type TCheckBoxState = 'cbUnchecked' | 'cbChecked' | 'cbGrayed';
type TLeftRight = 'taLeftJustify' | 'taRightJustify';
type TProgressBarOrientation = 'pbHorizontal' | 'pbVertical';
type TProgressBarState = 'pbsNormal' | 'pbsError' | 'pbsPaused';
type TTabPosition = 'tpTop' | 'tpBottom';
type TShiftStateItem = 'ssShift' | 'ssAlt' | 'ssCtrl' | 'ssMeta' | 'ssLeft' | 'ssRight' | 'ssMiddle' | 'ssDouble';
type TShiftState = TShiftStateItem[];
type TMouseButton = 'mbLeft' | 'mbRight' | 'mbMiddle';
type TDataSetState = 'dsInactive' | 'dsBrowse' | 'dsEdit' | 'dsInsert';
type TFieldType = 'ftUnknown' | 'ftString' | 'ftInteger' | 'ftFloat' | 'ftCurrency' | 'ftBoolean' | 'ftDate' | 'ftDateTime' | 'ftTime' | 'ftMemo' | 'ftBlob';
type TParamType = 'ptInput' | 'ptOutput' | 'ptInputOutput';
type TGridOption = 'dgTitles' | 'dgIndicator' | 'dgColLines' | 'dgRowLines' | 'dgRowSelect' | 'dgAlwaysShowSelection' | 'dgEditing' | 'dgStriped';
type TNavigateBtn = 'nbFirst' | 'nbPrior' | 'nbNext' | 'nbLast' | 'nbInsert' | 'nbDelete' | 'nbEdit' | 'nbPost' | 'nbCancel' | 'nbRefresh';
type TMsgDlgType = 'mtWarning' | 'mtError' | 'mtInformation' | 'mtConfirmation' | 'mtCustom';
type TMsgDlgBtn = 'mbYes' | 'mbNo' | 'mbOK' | 'mbCancel' | 'mbAbort' | 'mbRetry' | 'mbIgnore' | 'mbAll' | 'mbClose';
type TComponentStateFlag = 'csLoading' | 'csReading' | 'csDestroying' | 'csDesigning' | 'csUpdating';
type TOperation = 'opInsert' | 'opRemove';
interface TRect {
    Left: number;
    Top: number;
    Right: number;
    Bottom: number;
}
interface TPoint {
    X: number;
    Y: number;
}
declare function Rect(Left: number, Top: number, Right: number, Bottom: number): TRect;
declare function Point(X: number, Y: number): TPoint;
/** Modal results (Delphi mrXxx constants). */
type TModalResult = number;
declare const mrNone = 0;
declare const mrOk = 1;
declare const mrCancel = 2;
declare const mrAbort = 3;
declare const mrRetry = 4;
declare const mrIgnore = 5;
declare const mrYes = 6;
declare const mrNo = 7;
declare const mrClose = 8;
declare const mrAll = 12;
declare const ModalResultNames: Record<string, number>;
declare class EVclError extends Error {
    constructor(message: string);
}
declare class EComponentError extends EVclError {
    constructor(message: string);
}
declare class EListError extends EVclError {
    constructor(message: string);
}
declare class EDatabaseError extends EVclError {
    constructor(message: string);
}
declare class EConvertError extends EVclError {
    constructor(message: string);
}
declare function IsValidIdent(name: string): boolean;
declare function PtToPx(pt: number): number;
/** Strips '&' accelerators: "&Kaydet" → "Kaydet". */
declare function StripAccel(caption: string): string;
/** Only allow image sources that cannot execute script. */
declare function IsSafeImageSource(src: string): boolean;
/** All named colours, standard first (used by the Object Inspector colour editor). */
declare const ColorNames: readonly string[];
declare function IsValidColor(c: string): boolean;
/** Converts a Delphi colour (clRed, clBtnFace, $00BBGGRR, #RRGGBB) to a CSS colour. */
declare function ColorToCSS(c: TColor): string;
/** Resolves any colour to #rrggbb (system colours use their default theme value). */
declare function ColorToRGB(c: TColor): string;
declare const FontNames: readonly string[];
type TPropKind = 'int' | 'float' | 'string' | 'text' | 'bool' | 'enum' | 'set' | 'color' | 'font' | 'strings' | 'component' | 'connection' | 'table' | 'columns' | 'sql' | 'params' | 'image' | 'cursor' | 'datafield' | 'procname' | 'fieldlist' | 'modalresult' | 'fontname';
type TPropCategory = 'Layout' | 'Visual' | 'Behavior' | 'Input' | 'Data' | 'Database' | 'Help' | 'Misc';
interface TPropInfo {
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
interface TEventInfo {
    name: string;
    /** TypeScript parameter list used for stubs/IntelliSense, e.g. "Sender: TButton, e: MouseEvent". */
    params: string;
    hint?: string;
}
interface TComponentInfo {
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
    defaultSize?: {
        w: number;
        h: number;
    };
    abstract?: boolean;
}
interface TMergedComponentInfo extends TComponentInfo {
    ancestors: string[];
}
type TComponentClass<T extends TComponent = TComponent> = {
    new (AOwner?: TComponent | null): T;
    prototype: T;
};
/** Registers a component class together with its published RTTI. */
declare function RegisterClass(cls: TComponentClass, info: TComponentInfo): void;
declare function ClassNameOf(ctor: unknown): string;
/** Name of the nearest *registered* ancestor class (TButton for a user subclass of TButton). */
declare function RegisteredClassOf(obj: TObject): string;
declare function FindClass(name: string): TComponentClass | null;
declare function GetClass(name: string): TComponentClass;
declare function GetRegisteredClassNames(): string[];
/** RTTI with inherited properties/events merged (child overrides parent by name). */
declare function GetClassInfo(name: string): TMergedComponentInfo | null;
declare function InheritsFromClass(className: string, baseName: string): boolean;
declare function FindPropInfo(className: string, prop: string): TPropInfo | null;
declare class TObject {
    get ClassName(): string;
    InheritsFrom(className: string): boolean;
    ToString(): string;
    /** Delphi-style destructor. Override Destroy, call Free. */
    Destroy(): void;
    Free(): void;
}
declare class TPersistent extends TObject {
    Assign(Source: TPersistent | null): void;
    protected AssignTo(Dest: TPersistent): void;
}
/** Ordered list of strings (Items, Lines, SQL, Tabs). */
declare class TStrings extends TPersistent {
    protected FItems: string[];
    private FUpdateCount;
    private FDirty;
    OnChange: ((Sender: TStrings) => void) | null;
    get Count(): number;
    Get(Index: number): string;
    Put(Index: number, S: string): void;
    /** Read-only snapshot of the lines. */
    get Strings(): readonly string[];
    Add(S: string): number;
    Append(S: string): void;
    AddStrings(Source: TStrings | readonly string[]): void;
    Insert(Index: number, S: string): void;
    Delete(Index: number): void;
    Clear(): void;
    IndexOf(S: string): number;
    Contains(S: string): boolean;
    Exchange(Index1: number, Index2: number): void;
    Move(CurIndex: number, NewIndex: number): void;
    Sort(): void;
    get Text(): string;
    set Text(Value: string);
    get CommaText(): string;
    set CommaText(Value: string);
    /** name=value helpers */
    Names(Index: number): string;
    Values(Name: string): string;
    SetValue(Name: string, Value: string): void;
    ToArray(): string[];
    /** Replaces all lines at once (single OnChange). */
    SetStrings(Lines: readonly unknown[]): void;
    BeginUpdate(): void;
    EndUpdate(): void;
    Assign(Source: TPersistent | null): void;
    toJSON(): string[];
    [Symbol.iterator](): Iterator<string>;
    protected Changed(): void;
    private CheckIndex;
}
declare class TStringList extends TStrings {
}
interface TFontJSON {
    Name?: string;
    Size?: number;
    Color?: TColor;
    Style?: TFontStyle[];
}
declare class TFont extends TPersistent {
    static readonly DefaultName = "Segoe UI";
    static readonly DefaultSize = 9;
    static readonly DefaultColor: TColor;
    private FName;
    private FSize;
    private FColor;
    private FStyle;
    OnChange: ((Sender: TFont) => void) | null;
    get Name(): string;
    set Name(v: string);
    /** Size in points (Delphi semantics). */
    get Size(): number;
    set Size(v: number);
    get Color(): TColor;
    set Color(v: TColor);
    get Style(): TFontStyle[];
    set Style(v: TFontStyle[]);
    /** Font height in CSS pixels. */
    get PixelSize(): number;
    Assign(Source: TPersistent | null): void;
    toJSON(): Required<TFontJSON>;
    FromJSON(v: TFontJSON | null | undefined): void;
    IsDefault(): boolean;
    /** Applies the font to an element's inline style (CSSOM only — CSP friendly). */
    ApplyTo(style: CSSStyleDeclaration): void;
    static ClearFrom(style: CSSStyleDeclaration): void;
    protected Changed(): void;
}
interface TMouseEventArgs {
    Button: TMouseButton;
    Shift: TShiftState;
    X: number;
    Y: number;
    Event: MouseEvent;
}
interface TKeyEventArgs {
    /** DOM key value ("Enter", "a", "ArrowUp" …). Set to "" to swallow the key. */
    Key: string;
    KeyCode: number;
    Shift: TShiftState;
    Handled: boolean;
    Event: KeyboardEvent;
}
interface TKeyPressEventArgs {
    /** Character typed. Set to "" (Delphi: Key := #0) to cancel it. */
    Key: string;
    Handled: boolean;
    Event: KeyboardEvent;
}
interface TCloseEventArgs {
    Action: TCloseAction;
}
interface TCloseQueryEventArgs {
    CanClose: boolean;
}
interface TTabChangingEventArgs {
    AllowChange: boolean;
    NewIndex: number;
}
type TNotifyEvent = (this: any, Sender: any, e?: any) => unknown;
type TEventHandler<A = unknown> = (this: any, Sender: any, e: A) => unknown;
/** DOM element → owning control (used by the designer for hit testing). */
declare const ElementOwner: WeakMap<Element, TControl>;
declare class TComponent extends TPersistent {
    private FName;
    private FOwner;
    private FComponents;
    private FFreeNotifies;
    protected FComponentState: Set<TComponentStateFlag>;
    /** Free integer for user data (Delphi Tag). */
    Tag: number;
    /** Design-time icon position of non-visual components (Delphi DesignInfo). */
    DesignLeft: number;
    DesignTop: number;
    constructor(AOwner?: TComponent | null);
    /** Delphi-style constructor: `TButton.Create(this)`. */
    static Create<T extends TComponent>(this: new (AOwner?: TComponent | null) => T, AOwner?: TComponent | null): T;
    /** Called by Create() once the instance is fully constructed. */
    AfterConstruction(): void;
    get Name(): string;
    set Name(Value: string);
    protected NameChanged(_OldName: string, _NewName: string): void;
    get Owner(): TComponent | null;
    get Components(): readonly TComponent[];
    get ComponentCount(): number;
    get ComponentIndex(): number;
    get ComponentState(): ReadonlySet<TComponentStateFlag>;
    get Designing(): boolean;
    get Loading(): boolean;
    get Destroying(): boolean;
    FindComponent(AName: string): TComponent | null;
    InsertComponent(AComponent: TComponent): void;
    RemoveComponent(AComponent: TComponent): void;
    /** Changes creation order (used by the designer to keep the design file ordered). */
    SetComponentIndex(AComponent: TComponent, Index: number): void;
    /** Called when components are inserted/removed; override to clear references. */
    Notification(_AComponent: TComponent, _Operation: TOperation): void;
    /** Ask to be notified (opRemove) when AComponent is destroyed. */
    FreeNotification(AComponent: TComponent | null): void;
    RemoveFreeNotification(AComponent: TComponent | null): void;
    SetDesigning(Value: boolean, Recursive?: boolean): void;
    protected DesigningChanged(): void;
    /** Marks this component and everything it owns as being streamed in. */
    BeginLoading(): void;
    /** Ends streaming: owned components first (creation order), then self — like Delphi. */
    EndLoading(): void;
    /** Called once after all properties were streamed in. */
    protected Loaded(): void;
    /**
     * Invokes an event handler with Delphi semantics: `Sender` is this component, `this`
     * inside the handler is the owning form. Exceptions (sync or async) are routed to
     * Application.HandleException instead of crashing the app.
     */
    protected Fire(handler: TEventHandler<any> | TNotifyEvent | null | undefined, e?: unknown): unknown;
    DestroyComponents(): void;
    Destroy(): void;
    ToString(): string;
}
interface TAnchorRules {
    left: number;
    top: number;
    width: number;
    height: number;
    pw: number;
    ph: number;
}
declare class TControl extends TComponent {
    protected FParent: TWinControl | null;
    protected FLeft: number;
    protected FTop: number;
    protected FWidth: number;
    protected FHeight: number;
    protected FAlign: TAlign;
    protected FAnchors: TAnchorKind[];
    protected FVisible: boolean;
    protected FEnabled: boolean;
    protected FHint: string;
    protected FShowHint: boolean;
    protected FCursor: TCursor;
    protected FColor: TColor;
    protected FParentColor: boolean;
    protected FFont: TFont;
    protected FParentFont: boolean;
    protected FCaption: string;
    protected FElement: HTMLElement | null;
    protected FAnchorRules: TAnchorRules | null;
    protected FSettingAlignBounds: boolean;
    private FFontSyncing;
    OnClick: TNotifyEvent | null;
    OnDblClick: TNotifyEvent | null;
    OnMouseDown: TEventHandler<TMouseEventArgs> | null;
    OnMouseUp: TEventHandler<TMouseEventArgs> | null;
    OnMouseMove: TEventHandler<TMouseEventArgs> | null;
    OnMouseEnter: TNotifyEvent | null;
    OnMouseLeave: TNotifyEvent | null;
    OnResize: TNotifyEvent | null;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    /** The control's DOM element (created lazily after construction). */
    get Element(): HTMLElement;
    get HandleAllocated(): boolean;
    protected CreateElement(): HTMLElement;
    protected CreateHandle(): void;
    /** Subclasses apply their specific state to the freshly created element here. */
    protected ElementCreated(): void;
    protected AttachEvents(e: HTMLElement): void;
    /** True when a DOM event target belongs to a child *control* (not to our own parts). */
    protected IsInnerChildTarget(target: EventTarget | null): boolean;
    /** Programmatic click (Delphi Click). */
    Click(e?: MouseEvent): void;
    protected SyncNameAttr(): void;
    protected NameChanged(OldName: string, NewName: string): void;
    protected HasCaption(): boolean;
    protected DesigningChanged(): void;
    get Parent(): TWinControl | null;
    set Parent(AParent: TWinControl | null);
    /** Internal: invoked by TWinControl.Insert/RemoveControl. */
    SetParentInternal(AParent: TWinControl | null): void;
    protected ParentChanged(): void;
    IsChildOf(AControl: TControl): boolean;
    get Left(): number;
    set Left(v: number);
    get Top(): number;
    set Top(v: number);
    get Width(): number;
    set Width(v: number);
    get Height(): number;
    set Height(v: number);
    get BoundsRect(): TRect;
    set BoundsRect(r: TRect);
    get ClientWidth(): number;
    set ClientWidth(v: number);
    get ClientHeight(): number;
    set ClientHeight(v: number);
    get ClientRect(): TRect;
    SetBounds(ALeft: number, ATop: number, AWidth: number, AHeight: number): void;
    /** Used by the parent's alignment code: does not recapture anchors or re-trigger alignment. */
    SetAlignBounds(ALeft: number, ATop: number, AWidth: number, AHeight: number): void;
    protected Resized(): void;
    protected UpdateBoundsStyle(): void;
    /** Captures anchor distances relative to the parent's current client size. */
    UpdateAnchorRules(): void;
    /** Applies anchors after the parent's client area changed. */
    AnchorToParent(): void;
    get Align(): TAlign;
    set Align(v: TAlign);
    get Anchors(): TAnchorKind[];
    set Anchors(v: TAnchorKind[]);
    get Visible(): boolean;
    set Visible(v: boolean);
    protected VisibleChanged(): void;
    Show(): void;
    Hide(): void;
    /** At design time invisible controls are still drawn (Delphi behaviour). */
    get Showing(): boolean;
    protected UpdateVisibleStyle(): void;
    get Enabled(): boolean;
    set Enabled(v: boolean);
    protected UpdateEnabledStyle(): void;
    get Hint(): string;
    set Hint(v: string);
    get ShowHint(): boolean;
    set ShowHint(v: boolean);
    protected UpdateHintStyle(): void;
    get Cursor(): TCursor;
    set Cursor(v: TCursor);
    protected UpdateCursorStyle(): void;
    get Color(): TColor;
    set Color(v: TColor);
    get ParentColor(): boolean;
    set ParentColor(v: boolean);
    protected UpdateColorStyle(): void;
    /** Element whose background shows Color (inputs override). */
    protected ColorElement(): HTMLElement | null;
    get Font(): TFont;
    set Font(v: TFont);
    get ParentFont(): boolean;
    set ParentFont(v: boolean);
    /** Copies the parent's font without clearing ParentFont. */
    SyncParentFont(): void;
    protected FontChanged(): void;
    protected UpdateFontStyle(): void;
    /** Caption/Text storage shared by captioned controls. */
    protected GetCaption(): string;
    protected SetCaption(v: string): void;
    protected CaptionChanged(): void;
    BringToFront(): void;
    SendToBack(): void;
    /** Position of this control's top-left corner relative to the viewport. */
    ClientOrigin(): TPoint;
    ScreenToClient(P: TPoint): TPoint;
    ClientToScreen(P: TPoint): TPoint;
    /** Repaint is automatic with the DOM; kept for Delphi source compatibility. */
    Invalidate(): void;
    Repaint(): void;
    Refresh(): void;
    Destroy(): void;
}
declare class TGraphicControl extends TControl {
}
declare class TWinControl extends TControl {
    protected FControls: TControl[];
    protected FAlignLevel: number;
    protected FAlignPending: boolean;
    protected FAligning: boolean;
    protected FTabOrder: number;
    protected FTabStop: boolean;
    OnEnter: TNotifyEvent | null;
    OnExit: TNotifyEvent | null;
    OnKeyDown: TEventHandler<TKeyEventArgs> | null;
    OnKeyPress: TEventHandler<TKeyPressEventArgs> | null;
    OnKeyUp: TEventHandler<TKeyEventArgs> | null;
    /** Element that hosts child controls (TForm/TScrollBox override it). */
    get ClientElement(): HTMLElement;
    /** Element that receives keyboard focus. */
    get FocusElement(): HTMLElement;
    get Controls(): readonly TControl[];
    get ControlCount(): number;
    /** Containers accept child controls; plain TWinControls (TEdit…) do not at design time. */
    AcceptsControl(_AControl: TControl): boolean;
    InsertControl(AControl: TControl): void;
    RemoveControl(AControl: TControl): void;
    protected ControlsChanged(): void;
    /** Called when a child control moved or resized (TScrollBox grows its extent). */
    ChildBoundsChanged(_AControl: TControl): void;
    /** Changes z-order (and DOM order) of a child control. */
    SetChildOrder(AControl: TControl, Index: number): void;
    ContainsControl(AControl: TControl): boolean;
    FindChildControl(AName: string): TControl | null;
    DisableAlign(): void;
    EnableAlign(): void;
    Realign(): void;
    /** Client rectangle available for aligned children (Delphi AdjustClientRect). */
    AdjustClientRect(): TRect;
    /**
     * Delphi TWinControl.AlignControls: alTop, alBottom, alLeft, alRight then alClient
     * consume the client rectangle. Within one alignment children are ordered by their
     * current position so dragging an aligned control in the designer reorders it.
     */
    protected AlignControls(): void;
    protected Resized(): void;
    protected Loaded(): void;
    protected FontChanged(): void;
    protected UpdateColorStyle(): void;
    get TabOrder(): number;
    set TabOrder(v: number);
    get TabStop(): boolean;
    set TabStop(v: boolean);
    protected UpdateTabIndex(): void;
    protected ElementCreated(): void;
    protected DesigningChanged(): void;
    protected UpdateEnabledStyle(): void;
    get CanFocus(): boolean;
    get Focused(): boolean;
    SetFocus(): void;
    protected AttachEvents(e: HTMLElement): void;
    /** Used when OnKeyPress replaces the typed character (inputs override). */
    protected InsertTypedText(_Text: string): void;
    /** Destroying a windowed control destroys its child controls too (Delphi). */
    Destroy(): void;
}
/** TLabel — static text (TGraphicControl: never receives focus). */
declare class TLabel extends TGraphicControl {
    protected FAutoSize: boolean;
    protected FAlignment: TAlignment;
    protected FLayout: TTextLayout;
    protected FWordWrap: boolean;
    protected FTransparent: boolean;
    protected FShowAccelChar: boolean;
    protected FFocusControl: TWinControl | null;
    private FTextEl;
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    protected HasCaption(): boolean;
    get Caption(): string;
    set Caption(v: string);
    get AutoSize(): boolean;
    set AutoSize(v: boolean);
    get Alignment(): TAlignment;
    set Alignment(v: TAlignment);
    get Layout(): TTextLayout;
    set Layout(v: TTextLayout);
    get WordWrap(): boolean;
    set WordWrap(v: boolean);
    get Transparent(): boolean;
    set Transparent(v: boolean);
    get ShowAccelChar(): boolean;
    set ShowAccelChar(v: boolean);
    get FocusControl(): TWinControl | null;
    set FocusControl(v: TWinControl | null);
    Notification(AComponent: TComponent, Operation: TOperation): void;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    protected CaptionChanged(): void;
    protected UpdateColorStyle(): void;
    protected FontChanged(): void;
    protected ParentChanged(): void;
    protected Loaded(): void;
    get Accelerator(): string;
    private UpdateText;
    private UpdateTextLayout;
    /** AutoSize: measures the rendered caption (requires the element to be in a document). */
    AdjustSize(): void;
}
/** TButton — push button. A non-zero ModalResult closes a modal form. */
declare class TButton extends TWinControl {
    protected FDefault: boolean;
    protected FCancel: boolean;
    protected FModalResult: TModalResult;
    protected FWordWrap: boolean;
    private FCaptionEl;
    private FAccel;
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    protected HasCaption(): boolean;
    AcceptsControl(): boolean;
    get Caption(): string;
    set Caption(v: string);
    get Default(): boolean;
    set Default(v: boolean);
    get Cancel(): boolean;
    set Cancel(v: boolean);
    get ModalResult(): TModalResult;
    set ModalResult(v: TModalResult);
    get WordWrap(): boolean;
    set WordWrap(v: boolean);
    get Accelerator(): string;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    protected CaptionChanged(): void;
    protected UpdateEnabledStyle(): void;
    Click(e?: MouseEvent): void;
}
/** TEdit — single line text input. */
declare class TEdit extends TWinControl {
    protected FText: string;
    protected FMaxLength: number;
    protected FPasswordChar: string;
    protected FReadOnly: boolean;
    protected FCharCase: TEditCharCase;
    protected FTextHint: string;
    protected FAlignment: TAlignment;
    protected FNumbersOnly: boolean;
    protected FAutoSelect: boolean;
    protected FBorderStyle: TBorderStyle;
    OnChange: TNotifyEvent | null;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    AcceptsControl(): boolean;
    protected get Input(): HTMLInputElement;
    get Text(): string;
    set Text(v: string);
    get MaxLength(): number;
    set MaxLength(v: number);
    get PasswordChar(): string;
    set PasswordChar(v: string);
    get ReadOnly(): boolean;
    set ReadOnly(v: boolean);
    get CharCase(): TEditCharCase;
    set CharCase(v: TEditCharCase);
    get TextHint(): string;
    set TextHint(v: string);
    get Alignment(): TAlignment;
    set Alignment(v: TAlignment);
    get NumbersOnly(): boolean;
    set NumbersOnly(v: boolean);
    get AutoSelect(): boolean;
    set AutoSelect(v: boolean);
    get BorderStyle(): TBorderStyle;
    set BorderStyle(v: TBorderStyle);
    get SelStart(): number;
    set SelStart(v: number);
    get SelLength(): number;
    set SelLength(v: number);
    get SelText(): string;
    set SelText(v: string);
    SelectAll(): void;
    Clear(): void;
    protected CreateElement(): HTMLElement;
    protected ColorElement(): HTMLElement | null;
    protected ElementCreated(): void;
    /** Hook for data-aware descendants. */
    protected TextChangedByUser(): void;
    protected DoChange(): void;
    protected InsertTypedText(Text: string): void;
    protected UpdateInputAttrs(): void;
    protected UpdateEnabledStyle(): void;
    protected DesigningChanged(): void;
    private ApplyCharCase;
}
/** TMemo — multi line text editor bound to a TStrings (Lines). */
declare class TMemo extends TWinControl {
    readonly Lines: TStrings;
    protected FScrollBars: TScrollStyle;
    protected FWordWrap: boolean;
    protected FReadOnly: boolean;
    protected FMaxLength: number;
    protected FAlignment: TAlignment;
    protected FWantTabs: boolean;
    private FSyncing;
    OnChange: TNotifyEvent | null;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    AcceptsControl(): boolean;
    get Text(): string;
    set Text(v: string);
    get ScrollBars(): TScrollStyle;
    set ScrollBars(v: TScrollStyle);
    get WordWrap(): boolean;
    set WordWrap(v: boolean);
    get ReadOnly(): boolean;
    set ReadOnly(v: boolean);
    get MaxLength(): number;
    set MaxLength(v: number);
    get Alignment(): TAlignment;
    set Alignment(v: TAlignment);
    get WantTabs(): boolean;
    set WantTabs(v: boolean);
    Clear(): void;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    protected InsertTypedText(Text: string): void;
    private UpdateMemoAttrs;
    protected UpdateEnabledStyle(): void;
    protected DesigningChanged(): void;
}
/** TComboBox — drop-down list (csDropDownList) or editable combo (csDropDown). */
declare class TComboBox extends TWinControl {
    readonly Items: TStrings;
    protected FItemIndex: number;
    protected FText: string;
    protected FStyle: TComboBoxStyle;
    protected FSorted: boolean;
    protected FDropDownCount: number;
    protected FTextHint: string;
    private FInput;
    private FPopup;
    private FHot;
    private FCloseHandler;
    OnChange: TNotifyEvent | null;
    OnSelect: TNotifyEvent | null;
    OnDropDown: TNotifyEvent | null;
    OnCloseUp: TNotifyEvent | null;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    AcceptsControl(): boolean;
    get ItemIndex(): number;
    set ItemIndex(v: number);
    get Text(): string;
    set Text(v: string);
    get Style(): TComboBoxStyle;
    set Style(v: TComboBoxStyle);
    get Sorted(): boolean;
    set Sorted(v: boolean);
    get DropDownCount(): number;
    set DropDownCount(v: number);
    get TextHint(): string;
    set TextHint(v: string);
    get DroppedDown(): boolean;
    set DroppedDown(v: boolean);
    get FocusElement(): HTMLElement;
    Clear(): void;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    private HandleKey;
    private SelectByUser;
    private SortItemsSilently;
    private SyncInput;
    protected UpdateEnabledStyle(): void;
    protected DesigningChanged(): void;
    private OpenPopup;
    private PositionPopup;
    private RenderPopup;
    private ClosePopup;
    Destroy(): void;
}
/** Shared base of TCheckBox / TRadioButton. */
declare abstract class TButtonControl extends TWinControl {
    protected FAlignment: TLeftRight;
    protected FWordWrap: boolean;
    protected FBoxEl: HTMLSpanElement | null;
    protected FCaptionEl: HTMLSpanElement | null;
    protected HasCaption(): boolean;
    AcceptsControl(): boolean;
    get Caption(): string;
    set Caption(v: string);
    get Alignment(): TLeftRight;
    set Alignment(v: TLeftRight);
    get WordWrap(): boolean;
    set WordWrap(v: boolean);
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    protected CaptionChanged(): void;
    protected abstract UpdateCheckStyle(): void;
}
/** TCheckBox — two or three state check box. OnClick fires whenever State changes. */
declare class TCheckBox extends TButtonControl {
    protected FState: TCheckBoxState;
    protected FAllowGrayed: boolean;
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    get Checked(): boolean;
    set Checked(v: boolean);
    get State(): TCheckBoxState;
    set State(v: TCheckBoxState);
    get AllowGrayed(): boolean;
    set AllowGrayed(v: boolean);
    /** User click toggles the state (which fires OnClick once). */
    Click(): void;
    protected UpdateCheckStyle(): void;
}
/** TRadioButton — mutually exclusive with sibling radio buttons of the same parent. */
declare class TRadioButton extends TButtonControl {
    protected FChecked: boolean;
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    get Checked(): boolean;
    set Checked(v: boolean);
    Click(): void;
    protected UpdateCheckStyle(): void;
}
/**
 * Resolves project asset paths such as "assets/logo.png". Generated apps load them
 * relative to the page; the IDE designer points the resolver at the preview server.
 */
declare const AssetResolver: {
    Resolve: (Src: string) => string;
};
/** TImage — displays a picture (URL, project asset path or data: URI). */
declare class TImage extends TGraphicControl {
    protected FPicture: string;
    protected FStretch: boolean;
    protected FProportional: boolean;
    protected FCenter: boolean;
    private FImg;
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    get Picture(): string;
    set Picture(v: string);
    get Stretch(): boolean;
    set Stretch(v: boolean);
    get Proportional(): boolean;
    set Proportional(v: boolean);
    get Center(): boolean;
    set Center(v: boolean);
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    private UpdateImage;
}
/** TProgressBar — determinate or marquee progress indicator. */
declare class TProgressBar extends TWinControl {
    protected FMin: number;
    protected FMax: number;
    protected FPosition: number;
    protected FStep: number;
    protected FOrientation: TProgressBarOrientation;
    protected FBarState: TProgressBarState;
    protected FMarquee: boolean;
    private FBar;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    AcceptsControl(): boolean;
    get Min(): number;
    set Min(v: number);
    get Max(): number;
    set Max(v: number);
    get Position(): number;
    set Position(v: number);
    get Step(): number;
    set Step(v: number);
    get Orientation(): TProgressBarOrientation;
    set Orientation(v: TProgressBarOrientation);
    get State(): TProgressBarState;
    set State(v: TProgressBarState);
    get Marquee(): boolean;
    set Marquee(v: boolean);
    StepIt(): void;
    StepBy(Delta: number): void;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    private UpdateBar;
}
/** TPanel — container with optional caption and bevels. */
declare class TPanel extends TWinControl {
    protected FBevelOuter: TBevelCut;
    protected FBevelInner: TBevelCut;
    protected FBevelWidth: number;
    protected FBorderStyle: TBorderStyle;
    protected FAlignment: TAlignment;
    protected FVerticalAlignment: TTextLayout;
    protected FShowCaption: boolean;
    private FCaptionEl;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    protected HasCaption(): boolean;
    get Caption(): string;
    set Caption(v: string);
    get BevelOuter(): TBevelCut;
    set BevelOuter(v: TBevelCut);
    get BevelInner(): TBevelCut;
    set BevelInner(v: TBevelCut);
    get BevelWidth(): number;
    set BevelWidth(v: number);
    get BorderStyle(): TBorderStyle;
    set BorderStyle(v: TBorderStyle);
    get Alignment(): TAlignment;
    set Alignment(v: TAlignment);
    get VerticalAlignment(): TTextLayout;
    set VerticalAlignment(v: TTextLayout);
    get ShowCaption(): boolean;
    set ShowCaption(v: boolean);
    AdjustClientRect(): TRect;
    private BevelInset;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    protected CaptionChanged(): void;
    private UpdatePanelStyle;
}
/** TGroupBox — framed container with a caption. */
declare class TGroupBox extends TWinControl {
    private FLegend;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    protected HasCaption(): boolean;
    get Caption(): string;
    set Caption(v: string);
    AdjustClientRect(): TRect;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    protected CaptionChanged(): void;
}
/** TTabControl — tab strip with a single client area (Delphi semantics). */
declare class TTabControl extends TWinControl {
    readonly Tabs: TStrings;
    protected FTabIndex: number;
    protected FTabPosition: TTabPosition;
    private FStrip;
    OnChange: TNotifyEvent | null;
    OnChanging: TEventHandler<TTabChangingEventArgs> | null;
    static readonly TabStripHeight = 28;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    get TabIndex(): number;
    set TabIndex(v: number);
    get TabPosition(): TTabPosition;
    set TabPosition(v: TTabPosition);
    AdjustClientRect(): TRect;
    /** Index of the tab at a point in control coordinates (-1 when none) — used by the designer. */
    TabAtPoint(X: number, Y: number): number;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    private RenderTabs;
}
/** TScrollBox — scrollable container; children are positioned in a content layer. */
declare class TScrollBox extends TWinControl {
    protected FBorderStyle: TBorderStyle;
    protected FAutoScroll: boolean;
    private FContent;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    get ClientElement(): HTMLElement;
    get BorderStyle(): TBorderStyle;
    set BorderStyle(v: TBorderStyle);
    get AutoScroll(): boolean;
    set AutoScroll(v: boolean);
    get HorzScrollPos(): number;
    set HorzScrollPos(v: number);
    get VertScrollPos(): number;
    set VertScrollPos(v: number);
    ScrollInView(AControl: TControl): void;
    ClientOrigin(): TPoint;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    /** Grows the content layer so every child is reachable by scrolling. */
    UpdateExtent(): void;
    protected ControlsChanged(): void;
    ChildBoundsChanged(): void;
}
/** TTimer — non-visual periodic event source. Never runs at design time. */
declare class TTimer extends TComponent {
    protected FEnabled: boolean;
    protected FInterval: number;
    private FOnTimer;
    private FHandle;
    get Enabled(): boolean;
    set Enabled(v: boolean);
    get Interval(): number;
    set Interval(v: number);
    get OnTimer(): TNotifyEvent | null;
    set OnTimer(v: TNotifyEvent | null);
    protected Loaded(): void;
    protected DesigningChanged(): void;
    private UpdateTimer;
    Destroy(): void;
}
type TFormClass<T extends TCustomForm = TCustomForm> = {
    new (AOwner?: TComponent | null): T;
    prototype: T;
    Create(this: new (AOwner?: TComponent | null) => T, AOwner?: TComponent | null): T;
};
type TFormStateFlag = 'fsCreating' | 'fsModal' | 'fsShown' | 'fsActive';
declare function GetParentForm(AControl: TControl | null): TCustomForm | null;
/**
 * TCustomForm — a window. The same class renders the form in the IDE designer (inside a
 * shadow root, csDesigning) and in the running application (inside the VCL desktop).
 */
declare class TCustomForm extends TWinControl {
    protected FBorderStyle: TFormBorderStyle;
    protected FBorderIcons: TBorderIcon[];
    protected FPosition: TPosition;
    protected FWindowState: TWindowState;
    protected FKeyPreview: boolean;
    protected FModalResult: TModalResult;
    protected FActiveControl: TWinControl | null;
    protected FFormState: Set<TFormStateFlag>;
    private FTitleBar;
    private FCaptionEl;
    private FClientEl;
    private FSizeGrip;
    private FModalResolve;
    private FModalOverlay;
    private FRestoreBounds;
    OnCreate: TNotifyEvent | null;
    OnDestroy: TNotifyEvent | null;
    OnShow: TNotifyEvent | null;
    OnHide: TNotifyEvent | null;
    OnClose: TEventHandler<TCloseEventArgs> | null;
    OnCloseQuery: TEventHandler<TCloseQueryEventArgs> | null;
    OnActivate: TNotifyEvent | null;
    OnDeactivate: TNotifyEvent | null;
    constructor(AOwner?: TComponent | null);
    /** Delphi global form variable: `Form2.Instance` (auto-created by Application). */
    static GetInstance<T extends TCustomForm>(this: TFormClass<T>): T;
    /** `Form2.Show()` — shows the auto-created instance (Delphi: Form2.Show). */
    static Show<T extends TCustomForm>(this: TFormClass<T>): T;
    /** `await Form2.ShowModal()` — shows the auto-created instance modally. */
    static ShowModal<T extends TCustomForm>(this: TFormClass<T>): Promise<TModalResult>;
    static Hide<T extends TCustomForm>(this: TFormClass<T>): void;
    static Close<T extends TCustomForm>(this: TFormClass<T>): void;
    FrameMetrics(): {
        border: number;
        title: number;
    };
    get ClientWidth(): number;
    set ClientWidth(v: number);
    get ClientHeight(): number;
    set ClientHeight(v: number);
    get ClientElement(): HTMLElement;
    ClientOrigin(): TPoint;
    /** In the designer the window always sits at the surface origin; Left/Top only matter at runtime. */
    protected UpdateBoundsStyle(): void;
    protected DesigningChanged(): void;
    protected HasCaption(): boolean;
    get Caption(): string;
    set Caption(v: string);
    get BorderStyle(): TFormBorderStyle;
    set BorderStyle(v: TFormBorderStyle);
    get BorderIcons(): TBorderIcon[];
    set BorderIcons(v: TBorderIcon[]);
    get Position(): TPosition;
    set Position(v: TPosition);
    get WindowState(): TWindowState;
    set WindowState(v: TWindowState);
    get KeyPreview(): boolean;
    set KeyPreview(v: boolean);
    get ActiveControl(): TWinControl | null;
    set ActiveControl(v: TWinControl | null);
    get ModalResult(): TModalResult;
    set ModalResult(v: TModalResult);
    get Modal(): boolean;
    get Active(): boolean;
    Notification(AComponent: TComponent, Operation: TOperation): void;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    protected CaptionChanged(): void;
    protected ColorElement(): HTMLElement | null;
    protected UpdateColorStyle(): void;
    private UpdateFrame;
    /** Overridden by generated form classes: creates the designed components. */
    InitializeComponent(): void;
    AfterConstruction(): void;
    /** Binds a designer event (component.OnX → form method) at runtime. */
    BindEvent(AComponent: TComponent, EventName: string, HandlerName: string): void;
    /** Puts the (still hidden) window into the application desktop so it can measure text. */
    AttachToDesktop(): void;
    protected UpdateVisibleStyle(): void;
    protected VisibleChanged(): void;
    private FocusFirst;
    private PlaceWindow;
    private ApplyWindowState;
    /** Brings the window to the front and makes it the active form. */
    Activate(): void;
    Deactivate(): void;
    CloseQuery(): boolean;
    /** Delphi Close: OnCloseQuery → OnClose(Action) → hide/free. Closing the main form ends the app. */
    Close(): void;
    /** Shows the form modally. Resolves with ModalResult when the form closes. */
    ShowModal(): Promise<TModalResult>;
    private EndModal;
    /** Frees the form after the current event handler returns (Delphi Release). */
    Release(): void;
    Destroy(): void;
    /** Tab order traversal (depth-first by TabOrder), Delphi FindNextControl. */
    FindNextControl(CurControl: TWinControl | null, GoForward: boolean): TWinControl | null;
    SelectNext(CurControl: TWinControl | null, GoForward?: boolean): void;
    private FocusedControl;
    private AllControls;
    private AttachWindowBehaviour;
}
/** TForm — the class every designed form (Form1, Form2 …) derives from. */
declare class TForm extends TCustomForm {
}
declare class TScreen extends TObject {
    ActiveForm: TCustomForm | null;
    private FCursor;
    get Width(): number;
    get Height(): number;
    get Forms(): TCustomForm[];
    get FormCount(): number;
    get Cursor(): TCursor;
    set Cursor(v: TCursor);
}
declare class TApplication extends TComponent {
    Title: string;
    OnException: ((Sender: unknown, E: Error) => void) | null;
    private FMainForm;
    private FTerminated;
    private FInitialized;
    private FFormClasses;
    private FDesktop;
    private FZ;
    private FShowingException;
    get MainForm(): TCustomForm | null;
    get Terminated(): boolean;
    /** Root element that hosts all runtime windows. */
    get Desktop(): HTMLElement;
    NextZ(): number;
    get Forms(): TCustomForm[];
    Initialize(): void;
    RegisterFormClass(AClass: TFormClass, ClassName?: string): void;
    FindFormClass(Name: string): TFormClass | null;
    FindFormInstance<T extends TCustomForm>(AClass: TFormClass<T>): T | null;
    FindForm(Name: string): TCustomForm | null;
    /** Delphi Application.CreateForm — the first form created becomes MainForm. */
    CreateForm<T extends TCustomForm>(AClass: TFormClass<T> | string): T;
    /** Shows the main form (creating it first if needed). */
    Run(MainForm?: TFormClass | string): void;
    Terminate(): void;
    /** Default exception handler: OnException or an error dialog (Delphi behaviour). */
    HandleException(E: unknown, Sender?: unknown): void;
    ShowException(E: Error): void;
    /** Lets the browser render pending changes (Delphi ProcessMessages). */
    ProcessMessages(): Promise<void>;
    MessageBox(Text: string, Caption?: string, Buttons?: TMsgDlgBtn[]): Promise<TModalResult>;
}
declare const Application: TApplication;
declare const Screen: TScreen;
/** Delphi MessageDlg — resolves with the modal result of the pressed button. */
declare function MessageDlg(Msg: string, DlgType?: TMsgDlgType, Buttons?: TMsgDlgBtn[], Caption?: string): Promise<TModalResult>;
/** Delphi ShowMessage (asynchronous: `await ShowMessage('…')`). */
declare function ShowMessage(Msg: unknown): Promise<void>;
/** Yes/No confirmation helper. */
declare function Confirm(Msg: string, Caption?: string): Promise<boolean>;
/** Delphi InputQuery — resolves with the entered text or null when cancelled. */
declare function InputQuery(ACaption: string, APrompt: string, ADefault?: string): Promise<string | null>;
/** Delphi InputBox — resolves with ADefault when cancelled. */
declare function InputBox(ACaption: string, APrompt: string, ADefault?: string): Promise<string>;
declare function IntToStr(Value: number): string;
declare function StrToInt(S: string): number;
declare function StrToIntDef(S: string, Default: number): number;
declare function FloatToStr(Value: number): string;
declare function StrToFloat(S: string): number;
declare function StrToFloatDef(S: string, Default: number): number;
/** FormatFloat('#,##0.00', 1234.5) → "1.234,50" (Turkish separators). */
declare function FormatFloat(Format: string, Value: number): string;
/** FormatDateTime('dd.mm.yyyy hh:nn:ss', Now()). */
declare function FormatDateTime(Format: string, D: Date): string;
declare function Now(): Date;
declare function Trim(S: string): string;
declare function UpperCase(S: string): string;
declare function LowerCase(S: string): string;
declare function QuotedStr(S: string): string;
/** Format('%s: %d adet (%.2f)', ['Elma', 3, 1.5]) — %s %d %f %.Nf %% */
declare function Format(Fmt: string, Args: unknown[]): string;
declare function Sleep(Milliseconds: number): Promise<void>;
type TBridgeMessage = Record<string, unknown> & {
    type: string;
};
/**
 * postMessage bridge between a running app (inside the IDE's sandboxed preview iframe)
 * and the IDE: console output and runtime errors go to the Messages panel, the IDE can
 * hand over configuration and ask for a reload.
 */
declare const IdeBridge: {
    Installed: boolean;
    readonly Enabled: boolean;
    Post(msg: TBridgeMessage): void;
    Install(): void;
};
/** Named SQL parameters (":name"), skipping string literals, comments and "::" casts. */
declare function ExtractParamNames(SQL: string): string[];
interface TFieldDefJSON {
    name: string;
    type?: string;
    field_type?: TFieldType;
    nullable?: boolean;
    primary_key?: boolean;
    autoincrement?: boolean;
    size?: number;
}
interface TQueryResultJSON {
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
interface TDataServiceConfig {
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
declare class DataService {
    private static FConfig;
    private static FConnections;
    private static FTokenWaiters;
    static DetectDefaults(): TDataServiceConfig;
    static get Config(): Readonly<TDataServiceConfig>;
    static Configure(cfg: Partial<TDataServiceConfig>): void;
    /** Maps ConnectionDefName → backend connection id (emitted by the BuildService). */
    static RegisterConnections(Map: Record<string, string>): void;
    static ResolveConnection(Name: string): string;
    static HasConnection(Name: string): boolean;
    static Request<T = unknown>(Path: string, Body: unknown): Promise<T>;
    static Query(ConnectionId: string, SQL: string, Params?: Record<string, unknown>, Options?: {
        max_rows?: number;
        offset?: number;
        mode?: 'query' | 'exec';
    }): Promise<TQueryResultJSON>;
    static Table(ConnectionId: string, Request: Record<string, unknown>): Promise<TQueryResultJSON>;
    static Proc(ConnectionId: string, Name: string, Params: Record<string, unknown>): Promise<TQueryResultJSON>;
}
interface TParamJSON {
    Name: string;
    DataType?: TFieldType;
    Value?: unknown;
    ParamType?: TParamType;
}
declare class TParam extends TPersistent {
    Name: string;
    DataType: TFieldType;
    ParamType: TParamType;
    private FValue;
    get Value(): unknown;
    set Value(v: unknown);
    get IsNull(): boolean;
    get AsString(): string;
    set AsString(v: string);
    get AsInteger(): number;
    set AsInteger(v: number);
    get AsFloat(): number;
    set AsFloat(v: number);
    get AsBoolean(): boolean;
    set AsBoolean(v: boolean);
    get AsDateTime(): Date | null;
    set AsDateTime(v: Date | null);
    Clear(): void;
    /** Value converted according to DataType, ready to be JSON encoded. */
    BoundValue(): unknown;
    toJSON(): TParamJSON;
}
declare class TParams extends TPersistent {
    private FItems;
    get Count(): number;
    get Items(): readonly TParam[];
    FindParam(Name: string): TParam | null;
    ParamByName(Name: string): TParam;
    CreateParam(Name: string, DataType?: TFieldType): TParam;
    Clear(): void;
    /** Re-creates the list from the SQL text, keeping types/values of surviving params. */
    ParseSQL(SQL: string): void;
    ToValues(): Record<string, unknown>;
    toJSON(): TParamJSON[];
    FromJSON(v: unknown): void;
    Assign(Source: TPersistent | null): void;
    [Symbol.iterator](): Iterator<TParam>;
}
declare class TField extends TObject {
    FieldName: string;
    DataType: TFieldType;
    SqlType: string;
    Size: number;
    Required: boolean;
    ReadOnly: boolean;
    IsPrimaryKey: boolean;
    AutoIncrement: boolean;
    DisplayLabel: string;
    DisplayWidth: number;
    Visible: boolean;
    Index: number;
    private FDataSet;
    constructor(ADataSet: TDataSet);
    get DataSet(): TDataSet;
    get DisplayName(): string;
    get Alignment(): TAlignment;
    get Value(): unknown;
    set Value(v: unknown);
    get IsNull(): boolean;
    get AsString(): string;
    set AsString(v: string);
    get AsInteger(): number;
    set AsInteger(v: number);
    get AsFloat(): number;
    set AsFloat(v: number);
    get AsBoolean(): boolean;
    set AsBoolean(v: boolean);
    get AsDateTime(): Date | null;
    set AsDateTime(v: Date | null);
    /** Text for grids/edits (Turkish number and date formatting). */
    get DisplayText(): string;
    Clear(): void;
}
declare class TFields extends TObject {
    private FItems;
    get Count(): number;
    get Items(): readonly TField[];
    Get(Index: number): TField;
    FindField(Name: string): TField | null;
    FieldByName(Name: string): TField;
    IndexOf(F: TField): number;
    SetItems(Items: TField[]): void;
    [Symbol.iterator](): Iterator<TField>;
}
/** TConnection — refers to a backend connection definition by name (secrets never leave the server). */
declare class TConnection extends TComponent {
    protected FConnectionDefName: string;
    protected FConnected: boolean;
    protected FStreamedConnected: boolean;
    protected FLoginPrompt: boolean;
    private FDataSets;
    BeforeConnect: TNotifyEvent | null;
    AfterConnect: TNotifyEvent | null;
    AfterDisconnect: TNotifyEvent | null;
    get ConnectionDefName(): string;
    set ConnectionDefName(v: string);
    /** Backend connection id resolved from ConnectionDefName. */
    get ConnectionId(): string;
    get Connected(): boolean;
    set Connected(v: boolean);
    get LoginPrompt(): boolean;
    set LoginPrompt(v: boolean);
    get DataSets(): readonly TDataSet[];
    Open(): void;
    Close(): void;
    /** One-off parameterised SELECT → array of row objects. */
    Query(SQL: string, Params?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    /** One-off parameterised INSERT/UPDATE/DELETE → rows affected. */
    ExecSQL(SQL: string, Params?: Record<string, unknown>): Promise<number>;
    RegisterDataSet(ds: TDataSet): void;
    UnregisterDataSet(ds: TDataSet): void;
    protected Loaded(): void;
}
type TDataEvent = 'deActiveChanged' | 'deDataSetChange' | 'deRecordChange' | 'deDataSetScroll' | 'deUpdateState' | 'deFieldChange' | 'deLayoutChange';
/** Connects a data-aware control to a TDataSource. */
declare class TDataLink {
    private FDataSource;
    OnEvent: (Event: TDataEvent, Info?: unknown) => void;
    constructor(OnEvent: (Event: TDataEvent, Info?: unknown) => void);
    get DataSource(): TDataSource | null;
    set DataSource(v: TDataSource | null);
    get DataSet(): TDataSet | null;
    get Active(): boolean;
    get Editing(): boolean;
    DataEvent(Event: TDataEvent, Info?: unknown): void;
}
declare class TDataSource extends TComponent {
    protected FDataSet: TDataSet | null;
    protected FEnabled: boolean;
    protected FAutoEdit: boolean;
    private FLinks;
    OnDataChange: TEventHandler<{
        Field: TField | null;
    }> | null;
    OnStateChange: TNotifyEvent | null;
    get DataSet(): TDataSet | null;
    set DataSet(v: TDataSet | null);
    get Enabled(): boolean;
    set Enabled(v: boolean);
    get AutoEdit(): boolean;
    set AutoEdit(v: boolean);
    get State(): TDataSetState;
    /** Puts the dataset into edit mode when AutoEdit allows it. */
    Edit(): boolean;
    AddLink(L: TDataLink): void;
    RemoveLink(L: TDataLink): void;
    DataEvent(Event: TDataEvent, Info?: unknown): void;
    Notification(AComponent: TComponent, Operation: TOperation): void;
}
type TRecord = Record<string, unknown>;
/**
 * TDataSet — client-side record buffer with a Delphi state machine
 * (dsInactive → dsBrowse ⇄ dsEdit/dsInsert). Posting is optimistic: the local buffer
 * changes immediately and is rolled back if the backend rejects the change.
 */
declare abstract class TDataSet extends TComponent {
    protected FActive: boolean;
    protected FStreamedActive: boolean;
    protected FOpening: Promise<void> | null;
    protected FState: TDataSetState;
    protected FFields: TFields;
    protected FRecords: TRecord[];
    protected FIndex: number;
    protected FBof: boolean;
    protected FEof: boolean;
    protected FEditBuffer: TRecord | null;
    protected FOldValues: TRecord | null;
    protected FModified: boolean;
    protected FDisableCount: number;
    protected FPendingEvent: boolean;
    protected FDataSources: Set<TDataSource>;
    protected FConnection: TConnection | null;
    protected FMaxRows: number;
    protected FTruncated: boolean;
    protected FPrimaryKey: string[];
    BeforeOpen: TNotifyEvent | null;
    AfterOpen: TNotifyEvent | null;
    BeforeClose: TNotifyEvent | null;
    AfterClose: TNotifyEvent | null;
    BeforeInsert: TNotifyEvent | null;
    AfterInsert: TNotifyEvent | null;
    BeforeEdit: TNotifyEvent | null;
    AfterEdit: TNotifyEvent | null;
    BeforePost: TNotifyEvent | null;
    AfterPost: TNotifyEvent | null;
    BeforeCancel: TNotifyEvent | null;
    AfterCancel: TNotifyEvent | null;
    BeforeDelete: TNotifyEvent | null;
    AfterDelete: TNotifyEvent | null;
    BeforeScroll: TNotifyEvent | null;
    AfterScroll: TNotifyEvent | null;
    OnNewRecord: TNotifyEvent | null;
    OnPostError: TEventHandler<{
        Error: Error;
    }> | null;
    get Connection(): TConnection | null;
    set Connection(v: TConnection | null);
    get Active(): boolean;
    set Active(v: boolean);
    get MaxRows(): number;
    set MaxRows(v: number);
    get State(): TDataSetState;
    get Fields(): TFields;
    get FieldCount(): number;
    get RecordCount(): number;
    /** 1-based current record number (0 when empty). */
    get RecNo(): number;
    set RecNo(v: number);
    get Bof(): boolean;
    get Eof(): boolean;
    get IsEmpty(): boolean;
    get Modified(): boolean;
    /** True when the server stopped at MaxRows. */
    get Truncated(): boolean;
    get PrimaryKey(): readonly string[];
    get CanModify(): boolean;
    get ControlsDisabled(): boolean;
    /** Snapshot of the current record (edit buffer while editing). */
    get CurrentRecord(): Readonly<TRecord> | null;
    RecordAt(Index: number): Readonly<TRecord> | null;
    Open(): Promise<void>;
    Close(): void;
    /** Reloads the data, trying to keep the current position. */
    Refresh(): Promise<void>;
    protected SetData(data: TQueryResultJSON): void;
    protected abstract DoOpenData(): Promise<TQueryResultJSON>;
    /** Writes one change to the backend; may return server generated values (e.g. ids). */
    protected DoApply(_Kind: 'insert' | 'update' | 'delete', _Rec: TRecord, _Old: TRecord | null): Promise<TRecord | void>;
    protected ConnectionIdOrThrow(): string;
    protected CheckActive(): void;
    /** Posts pending edits (optimistically) before navigating — Delphi CheckBrowseMode. */
    CheckBrowseMode(): void;
    /** Moves the cursor; Bof/Eof are set when the request falls outside the records. */
    private MoveTo;
    First(): void;
    Last(): void;
    /** Next on the last record sets Eof (classic `while (!ds.Eof) { …; ds.Next(); }` loop). */
    Next(): void;
    Prior(): void;
    MoveBy(Distance: number): number;
    /** Locate('sehir;aktif', ['Ankara', true], { caseInsensitive: true }) */
    Locate(KeyFields: string, KeyValues: unknown, Options?: {
        caseInsensitive?: boolean;
        partialKey?: boolean;
    }): boolean;
    Lookup(KeyFields: string, KeyValues: unknown, ResultFields: string): unknown;
    /** Iterates all records: `ds.ForEach(r => console.log(r.ad))` (return false to stop). */
    ForEach(Callback: (Rec: Readonly<TRecord>, Index: number) => void | boolean): void;
    ToArray(): TRecord[];
    FieldByName(Name: string): TField;
    FindField(Name: string): TField | null;
    FieldValues(Name: string): unknown;
    GetFieldValue(Name: string): unknown;
    SetFieldValue(Name: string, Value: unknown): void;
    Edit(): void;
    Insert(): void;
    Append(): void;
    private StartInsert;
    Cancel(): void;
    /** Saves the edit buffer (optimistic; rolled back when the backend rejects it). */
    Post(): Promise<void>;
    Delete(): Promise<void>;
    DisableControls(): void;
    EnableControls(): void;
    RegisterDataSource(ds: TDataSource): void;
    UnregisterDataSource(ds: TDataSource): void;
    protected DataEvent(Event: TDataEvent, Info?: unknown): void;
    protected Loaded(): void;
    Notification(AComponent: TComponent, Operation: TOperation): void;
    Destroy(): void;
}
/** TQuery — dataset defined by a parameterised SQL statement. */
declare class TQuery extends TDataSet {
    readonly SQL: TStrings;
    readonly Params: TParams;
    protected FParamCheck: boolean;
    RowsAffected: number;
    constructor(AOwner?: TComponent | null);
    get ParamCheck(): boolean;
    set ParamCheck(v: boolean);
    ParamByName(Name: string): TParam;
    /** Executes INSERT/UPDATE/DELETE. Returns (and stores) RowsAffected. */
    ExecSQL(): Promise<number>;
    Prepare(): void;
    protected DoOpenData(): Promise<TQueryResultJSON>;
}
/** TTable — whole-table dataset with inserts/updates/deletes through the backend table API. */
declare class TTable extends TDataSet {
    protected FTableName: string;
    protected FIndexFieldNames: string;
    protected FFieldList: string;
    protected FReadOnly: boolean;
    protected FMasterSource: TDataSource | null;
    protected FMasterFields: string;
    private FMasterLink;
    private FMasterRefreshQueued;
    constructor(AOwner?: TComponent | null);
    get TableName(): string;
    set TableName(v: string);
    /** "soyad;ad" — ORDER BY columns (prefix with "-" for descending). */
    get IndexFieldNames(): string;
    set IndexFieldNames(v: string);
    /** Semicolon separated column list to fetch (empty = all columns). */
    get FieldList(): string;
    set FieldList(v: string);
    get ReadOnly(): boolean;
    set ReadOnly(v: boolean);
    get MasterSource(): TDataSource | null;
    set MasterSource(v: TDataSource | null);
    /** "musteri_id=id" — detail field = master field pairs separated by ';'. */
    get MasterFields(): string;
    set MasterFields(v: string);
    get CanModify(): boolean;
    Notification(AComponent: TComponent, Operation: TOperation): void;
    private MasterWhere;
    private MasterChanged;
    protected DoOpenData(): Promise<TQueryResultJSON>;
    protected DoApply(Kind: 'insert' | 'update' | 'delete', Rec: TRecord, Old: TRecord | null): Promise<TRecord | void>;
}
/** TStoredProc — calls a stored procedure/function; result rows become the dataset. */
declare class TStoredProc extends TDataSet {
    protected FStoredProcName: string;
    readonly Params: TParams;
    get StoredProcName(): string;
    set StoredProcName(v: string);
    ParamByName(Name: string): TParam;
    ExecProc(): Promise<void>;
    protected DoOpenData(): Promise<TQueryResultJSON>;
}
interface TGridColumnJSON {
    FieldName: string;
    Title?: string;
    Width?: number;
    Alignment?: TAlignment;
    Visible?: boolean;
    /** Numeric display format, e.g. "#,##0.00" (Delphi TNumericField.DisplayFormat). */
    DisplayFormat?: string;
}
interface TGridCellEventArgs {
    Column: TGridColumnJSON;
    Field: TField | null;
    Row: number;
}
/** TDBGrid — virtualised, editable data grid bound to a TDataSource. */
declare class TDBGrid extends TWinControl {
    protected FColumns: TGridColumnJSON[];
    protected FOptions: TGridOption[];
    protected FReadOnly: boolean;
    protected FRowHeight: number;
    private FLink;
    private FScroll;
    private FTable;
    private FHead;
    private FBody;
    private FEmpty;
    private FCols;
    private FEditor;
    private FRenderQueued;
    OnCellClick: TEventHandler<TGridCellEventArgs> | null;
    OnTitleClick: TEventHandler<{
        Column: TGridColumnJSON;
    }> | null;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    AcceptsControl(): boolean;
    get DataSource(): TDataSource | null;
    set DataSource(v: TDataSource | null);
    get Columns(): TGridColumnJSON[];
    set Columns(v: TGridColumnJSON[]);
    get Options(): TGridOption[];
    set Options(v: TGridOption[]);
    get ReadOnly(): boolean;
    set ReadOnly(v: boolean);
    get DefaultRowHeight(): number;
    set DefaultRowHeight(v: number);
    /** Field of the selected column (first column when none). */
    get SelectedField(): TField | null;
    Notification(AComponent: TComponent, Operation: TOperation): void;
    private has;
    protected CreateElement(): HTMLElement;
    protected ElementCreated(): void;
    protected Resized(): void;
    private LinkEvent;
    private QueueRender;
    private BuildColumns;
    private Render;
    private RowCount;
    private RenderRows;
    private FormatCell;
    private ScrollToCurrent;
    private CellFromEvent;
    private BodyMouseDown;
    private BodyDblClick;
    private CanEdit;
    private BeginEdit;
    private CommitEditor;
    private GridKeyDown;
}
/** TDBNavigator — First/Prior/Next/Last/Insert/Delete/Edit/Post/Cancel/Refresh buttons. */
declare class TDBNavigator extends TWinControl {
    protected FVisibleButtons: TNavigateBtn[];
    protected FConfirmDelete: boolean;
    private FLink;
    private FButtons;
    constructor(AOwner?: TComponent | null);
    protected GetDefaultSize(): {
        w: number;
        h: number;
    };
    AcceptsControl(): boolean;
    get DataSource(): TDataSource | null;
    set DataSource(v: TDataSource | null);
    get VisibleButtons(): TNavigateBtn[];
    set VisibleButtons(v: TNavigateBtn[]);
    get ConfirmDelete(): boolean;
    set ConfirmDelete(v: boolean);
    Notification(AComponent: TComponent, Operation: TOperation): void;
    protected ElementCreated(): void;
    private BuildButtons;
    private UpdateButtons;
    /** Performs a navigator action (Delphi BtnClick). */
    BtnClick(Button: TNavigateBtn): Promise<void>;
}
/** TDBEdit — TEdit bound to one field of the current record. */
declare class TDBEdit extends TEdit {
    protected FDataField: string;
    private FLink;
    private FUpdating;
    constructor(AOwner?: TComponent | null);
    get DataSource(): TDataSource | null;
    set DataSource(v: TDataSource | null);
    get DataField(): string;
    set DataField(v: string);
    get Field(): TField | null;
    Notification(AComponent: TComponent, Operation: TOperation): void;
    protected ElementCreated(): void;
    private LinkEvent;
    protected TextChangedByUser(): void;
}
/** One node of a Form.design.tson component tree. */
interface TDesignNode {
    class: string;
    name: string;
    props?: Record<string, unknown>;
    events?: Record<string, string>;
    children?: TDesignNode[];
}
/** Form{N}.design.tson — Delphi .dfm equivalent (canonical, diff friendly JSON). */
interface TDesignDocument {
    format: 'jsd-design';
    version: number;
    form: TDesignNode;
}
/**
 * Applies one published property. The Object Inspector, LoadDesign and the
 * BuildService generated code all end up in exactly these setters (WYSIWYG).
 */
declare function SetPropValue(Comp: TComponent, Info: TPropInfo | string, Value: unknown, Resolve?: (Name: string) => TComponent | null): void;
/** Reads a published property as a JSON value (component references → names). */
declare function GetPropValue(Comp: TComponent, Info: TPropInfo | string): unknown;
/** True when a property value equals its RTTI default (and therefore is not written). */
declare function IsDefaultPropValue(Info: TPropInfo, Value: unknown): boolean;
/**
 * Streams a design document into a form (Delphi TReader): components are created in
 * pre-order, properties applied in RTTI order, component references resolved last,
 * then Loaded() runs for everything. The designer uses it with csDesigning set.
 */
declare function LoadDesign(Form: TCustomForm, Doc: TDesignDocument | TDesignNode, Warn?: (m: string) => void): Map<string, TComponent>;
/** Serialises one component (non-default published properties only). */
declare function SaveComponentNode(Comp: TComponent, Events?: Record<string, string>): TDesignNode;
/** Serialises a whole form (TWriter equivalent). Non-visual components follow the controls. */
declare function SaveDesign(Form: TCustomForm): TDesignDocument;
declare const EnumTypes: Record<string, readonly string[]>;
declare const PaletteOrder: readonly string[];
declare const CategoryLabels: Record<TPropCategory, string>;
interface TRuntimeManifest {
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
declare function GetRuntimeManifest(): TRuntimeManifest;
