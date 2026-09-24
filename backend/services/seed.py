"""Demo content: a "Müşteri Takip" project with three forms and a SQLite database.

Created on first start (JSD_SEED_DEMO=1) for the dev user and whenever a project is
created with ``template="demo"``. It exercises most of the stack: visual/non-visual
components, TQuery with parameters, INSERT via ExecSQL, TTable master/detail, TDBGrid,
TDBNavigator, TTimer, modal forms and the IDE ↔ runtime bridge.
"""
from __future__ import annotations

import base64
import logging
import sqlite3
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db import SessionLocal
from backend.models import Project, User
from backend.schemas import FormCreate, ProjectCreate
from backend.services.file_service import files

log = logging.getLogger("jsdelphi.seed")


def C(cls: str, name: str, props: dict[str, Any] | None = None, events: dict[str, str] | None = None, children: list | None = None) -> dict[str, Any]:
    node: dict[str, Any] = {"class": cls, "name": name, "props": props or {}}
    if events:
        node["events"] = events
    if children:
        node["children"] = children
    return node


def B(left: int, top: int, width: int, height: int, **extra: Any) -> dict[str, Any]:
    return {"Left": left, "Top": top, "Width": width, "Height": height, **extra}


WHITE_BOLD = {"Name": "Segoe UI", "Size": 15, "Color": "clWhite", "Style": ["fsBold"]}
MUTED = {"Name": "Segoe UI", "Size": 9, "Color": "#cfe3f7", "Style": []}
ANCHOR_ALL = ["akLeft", "akTop", "akRight", "akBottom"]

_LOGO_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e81224"/>'
    '<stop offset="1" stop-color="#7a0c96"/></linearGradient></defs>'
    '<rect x="4" y="4" width="56" height="56" rx="14" fill="url(#g)"/>'
    '<path d="M20 18h12c9 0 14 6 14 14s-5 14-14 14H20z" fill="none" stroke="#fff" stroke-width="5"/>'
    "</svg>"
)
LOGO = "data:image/svg+xml;base64," + base64.b64encode(_LOGO_SVG.encode()).decode()


def form1_design() -> dict[str, Any]:
    return {
        "format": "jsd-design",
        "version": 1,
        "form": C(
            "TForm",
            "Form1",
            {"Caption": "Müşteri Takip", "ClientWidth": 760, "ClientHeight": 520, "Position": "poScreenCenter"},
            {"OnCreate": "Form1_OnCreate"},
            [
                C(
                    "TPanel",
                    "pnlBaslik",
                    {**B(0, 0, 760, 60), "Align": "alTop", "BevelOuter": "bvNone", "Color": "#0f5ea8", "ShowCaption": False, "TabOrder": 0},
                    None,
                    [
                        C("TLabel", "lblBaslik", {**B(16, 8, 250, 27), "Caption": "Müşteri Takip Sistemi", "Font": WHITE_BOLD, "ParentFont": False}),
                        C("TLabel", "lblAltBaslik", {**B(17, 36, 300, 15), "Caption": "JS-Delphi · TQuery + TDataSource + TDBGrid örneği", "Font": MUTED, "ParentFont": False}),
                        C("TButton", "btnHakkinda", {**B(646, 16, 98, 28), "Caption": "&Hakkında…", "Anchors": ["akTop", "akRight"], "TabOrder": 1}, {"OnClick": "btnHakkinda_OnClick"}),
                        C("TButton", "btnSiparisler", {**B(538, 16, 102, 28), "Caption": "&Siparişler…", "Anchors": ["akTop", "akRight"], "TabOrder": 0}, {"OnClick": "btnSiparisler_OnClick"}),
                    ],
                ),
                C(
                    "TGroupBox",
                    "grpKayit",
                    {**B(12, 70, 300, 262), "Caption": "Yeni müşteri", "TabOrder": 1},
                    None,
                    [
                        C("TLabel", "lblAd", {**B(14, 32, 20, 15), "Caption": "&Ad", "FocusControl": "edtAd"}),
                        C("TEdit", "edtAd", {**B(84, 28, 200, 25), "TextHint": "Müşterinin adı", "TabOrder": 0}),
                        C("TLabel", "lblSoyad", {**B(14, 66, 36, 15), "Caption": "Soyad"}),
                        C("TEdit", "edtSoyad", {**B(84, 62, 200, 25), "TextHint": "Soyadı", "TabOrder": 1}),
                        C("TLabel", "lblSehir", {**B(14, 100, 29, 15), "Caption": "Şehir"}),
                        C(
                            "TComboBox",
                            "cmbSehir",
                            {
                                **B(84, 96, 200, 25),
                                "Style": "csDropDownList",
                                "Items": ["Ankara", "İstanbul", "İzmir", "Bursa", "Antalya", "Konya", "Eskişehir", "Trabzon"],
                                "ItemIndex": 0,
                                "TabOrder": 2,
                            },
                        ),
                        C("TLabel", "lblBakiye", {**B(14, 134, 38, 15), "Caption": "Bakiye"}),
                        C("TEdit", "edtBakiye", {**B(84, 130, 200, 25), "TextHint": "0,00", "Alignment": "taRightJustify", "TabOrder": 3}),
                        C("TCheckBox", "chkAktif", {**B(84, 166, 150, 19), "Caption": "Aktif müşteri", "Checked": True, "TabOrder": 4}),
                        C("TButton", "btnKaydet", {**B(84, 206, 98, 30), "Caption": "&Kaydet", "Default": True, "TabOrder": 5}, {"OnClick": "btnKaydet_OnClick"}),
                        C("TButton", "btnTemizle", {**B(188, 206, 96, 30), "Caption": "&Temizle", "TabOrder": 6}, {"OnClick": "btnTemizle_OnClick"}),
                    ],
                ),
                C("TLabel", "lblAra", {**B(326, 81, 76, 15), "Caption": "Şehir filtresi"}),
                C("TEdit", "edtAra", {**B(410, 76, 180, 25), "TextHint": "örn. Ankara", "TabOrder": 2}, {"OnChange": "edtAra_OnChange"}),
                C(
                    "TDBGrid",
                    "DBGrid1",
                    {
                        **B(326, 108, 422, 190),
                        "Anchors": ANCHOR_ALL,
                        "DataSource": "dsMusteriler",
                        "TabOrder": 3,
                        "Columns": [
                            {"FieldName": "id", "Title": "No", "Width": 42},
                            {"FieldName": "ad", "Title": "Ad", "Width": 92},
                            {"FieldName": "soyad", "Title": "Soyad", "Width": 96},
                            {"FieldName": "sehir", "Title": "Şehir", "Width": 86},
                            {"FieldName": "bakiye", "Title": "Bakiye", "Width": 88, "Alignment": "taRightJustify", "DisplayFormat": "#,##0.00"},
                        ],
                    },
                    {"OnCellClick": "DBGrid1_OnCellClick"},
                ),
                C(
                    "TDBNavigator",
                    "DBNavigator1",
                    {**B(326, 304, 250, 28), "DataSource": "dsMusteriler", "Anchors": ["akLeft", "akBottom"], "VisibleButtons": ["nbFirst", "nbPrior", "nbNext", "nbLast", "nbRefresh"]},
                ),
                C(
                    "TMemo",
                    "memLog",
                    {
                        **B(12, 342, 560, 136),
                        "Anchors": ["akLeft", "akRight", "akBottom"],
                        "ReadOnly": True,
                        "Lines": ["Uygulama günlüğü"],
                        "Font": {"Name": "Consolas", "Size": 9, "Color": "#1f3b57", "Style": []},
                        "ParentFont": False,
                        "Color": "#f7fafd",
                        "TabOrder": 4,
                    },
                ),
                C(
                    "TPanel",
                    "pnlDurum",
                    {**B(0, 488, 760, 32), "Align": "alBottom", "BevelOuter": "bvNone", "Color": "#e8eef6", "ShowCaption": False, "TabOrder": 5},
                    None,
                    [
                        C("TLabel", "lblDurum", {**B(12, 8, 40, 15), "Caption": "Hazır"}),
                        C("TProgressBar", "ProgressBar1", {**B(420, 11, 180, 10), "Anchors": ["akTop", "akRight"]}),
                        C("TLabel", "lblSaat", {**B(690, 8, 58, 15), "Caption": "00:00:00", "Alignment": "taRightJustify", "Anchors": ["akTop", "akRight"]}),
                    ],
                ),
                C("TConnection", "Connection1", {"ConnectionDefName": "DemoDB", "DesignLeft": 590, "DesignTop": 348}),
                C(
                    "TQuery",
                    "qryMusteriler",
                    {
                        "Connection": "Connection1",
                        "SQL": ["SELECT id, ad, soyad, sehir, bakiye", "FROM musteriler", "WHERE sehir LIKE :sehir", "ORDER BY ad, soyad"],
                        "Params": [{"Name": "sehir", "DataType": "ftString", "Value": "%"}],
                        "Active": True,
                        "DesignLeft": 656,
                        "DesignTop": 348,
                    },
                    {"AfterOpen": "qryMusteriler_AfterOpen"},
                ),
                C("TDataSource", "dsMusteriler", {"DataSet": "qryMusteriler", "DesignLeft": 722, "DesignTop": 348}),
                C(
                    "TQuery",
                    "qryEkle",
                    {
                        "Connection": "Connection1",
                        "SQL": [
                            "INSERT INTO musteriler (ad, soyad, sehir, bakiye, aktif, kayit_tarihi)",
                            "VALUES (:ad, :soyad, :sehir, :bakiye, :aktif, :tarih)",
                        ],
                        "Params": [
                            {"Name": "ad", "DataType": "ftString"},
                            {"Name": "soyad", "DataType": "ftString"},
                            {"Name": "sehir", "DataType": "ftString"},
                            {"Name": "bakiye", "DataType": "ftCurrency"},
                            {"Name": "aktif", "DataType": "ftBoolean"},
                            {"Name": "tarih", "DataType": "ftDate"},
                        ],
                        "DesignLeft": 590,
                        "DesignTop": 408,
                    },
                ),
                C("TTimer", "Timer1", {"Interval": 1000, "DesignLeft": 656, "DesignTop": 408}, {"OnTimer": "Timer1_OnTimer"}),
            ],
        ),
    }


FORM1_CODE = """// Form1.ts — "Müşteri Takip" ana formunun kod birimi (unit).
// Olay işleyicileri Form1.prototype üzerine tanımlanır; `this` formun kendisidir.
// Veritabanı: TQuery parametreleri (:ad) sunucuda bağlanır — SQL metnine değer eklenmez.

function yaz(form, mesaj) {
  form.memLog.Lines.Add(FormatDateTime('hh:nn:ss', Now()) + '  ' + mesaj);
}

Form1.prototype.Form1_OnCreate = function (Sender, e) {
  this.lblSaat.Caption = FormatDateTime('hh:nn:ss', Now());
  yaz(this, 'Form oluşturuldu, müşteri listesi yükleniyor…');
};

Form1.prototype.qryMusteriler_AfterOpen = function (Sender, e) {
  this.lblDurum.Caption = Sender.RecordCount + ' müşteri listelendi';
  yaz(this, 'Sorgu açıldı: ' + Sender.RecordCount + ' kayıt');
};

Form1.prototype.btnKaydet_OnClick = async function (Sender, e) {
  if (Trim(this.edtAd.Text) === '' || Trim(this.edtSoyad.Text) === '') {
    await MessageDlg('Ad ve soyad zorunludur.', 'mtWarning', ['mbOK']);
    this.edtAd.SetFocus();
    return;
  }
  const q = this.qryEkle;
  q.ParamByName('ad').AsString = Trim(this.edtAd.Text);
  q.ParamByName('soyad').AsString = Trim(this.edtSoyad.Text);
  q.ParamByName('sehir').AsString = this.cmbSehir.Text;
  q.ParamByName('bakiye').AsFloat = StrToFloatDef(this.edtBakiye.Text, 0);
  q.ParamByName('aktif').AsBoolean = this.chkAktif.Checked;
  q.ParamByName('tarih').AsString = FormatDateTime('yyyy-mm-dd', Now());
  this.ProgressBar1.Marquee = true;
  try {
    const n = await q.ExecSQL();
    await this.qryMusteriler.Refresh();
    this.lblDurum.Caption = this.qryMusteriler.RecordCount + ' müşteri listelendi';
    yaz(this, n + ' kayıt eklendi: ' + this.edtAd.Text + ' ' + this.edtSoyad.Text);
    this.btnTemizle.Click();
  } finally {
    this.ProgressBar1.Marquee = false;
  }
};

Form1.prototype.btnTemizle_OnClick = function (Sender, e) {
  this.edtAd.Clear();
  this.edtSoyad.Clear();
  this.edtBakiye.Clear();
  this.cmbSehir.ItemIndex = 0;
  this.chkAktif.Checked = true;
  this.edtAd.SetFocus();
};

Form1.prototype.edtAra_OnChange = async function (Sender, e) {
  this.qryMusteriler.ParamByName('sehir').AsString = '%' + Trim(this.edtAra.Text) + '%';
  await this.qryMusteriler.Refresh();
  this.lblDurum.Caption = this.qryMusteriler.RecordCount + ' müşteri bulundu';
};

Form1.prototype.DBGrid1_OnCellClick = function (Sender, e) {
  const ds = this.qryMusteriler;
  this.lblDurum.Caption = ds.FieldByName('ad').AsString + ' ' + ds.FieldByName('soyad').AsString +
    ' — bakiye ' + FormatFloat('#,##0.00', ds.FieldByName('bakiye').AsFloat) + ' ₺';
};

Form1.prototype.btnHakkinda_OnClick = async function (Sender, e) {
  const sonuc = await Form2.ShowModal();
  yaz(this, 'Hakkında penceresi kapandı (ModalResult = ' + sonuc + ')');
};

Form1.prototype.btnSiparisler_OnClick = function (Sender, e) {
  Form3.Show();
  yaz(this, 'Sipariş ekranı açıldı');
};

Form1.prototype.Timer1_OnTimer = function (Sender, e) {
  this.lblSaat.Caption = FormatDateTime('hh:nn:ss', Now());
};
"""


def form2_design() -> dict[str, Any]:
    return {
        "format": "jsd-design",
        "version": 1,
        "form": C(
            "TForm",
            "Form2",
            {"Caption": "Hakkında", "ClientWidth": 392, "ClientHeight": 212, "BorderStyle": "bsDialog", "Position": "poMainFormCenter"},
            None,
            [
                C("TImage", "imgLogo", {**B(20, 22, 64, 64), "Picture": LOGO, "Stretch": True, "Proportional": True}),
                C("TLabel", "lblUrun", {**B(100, 22, 220, 21), "Caption": "JS-Delphi Müşteri Takip", "Font": {"Name": "Segoe UI", "Size": 12, "Color": "clWindowText", "Style": ["fsBold"]}, "ParentFont": False}),
                C("TLabel", "lblSurum", {**B(100, 50, 180, 15), "Caption": "Sürüm 1.0 · VCL runtime 1.0.0", "Font": {"Name": "Segoe UI", "Size": 9, "Color": "clGrayText", "Style": []}, "ParentFont": False}),
                C(
                    "TLabel",
                    "lblAciklama",
                    {**B(100, 76, 272, 64), "AutoSize": False, "WordWrap": True, "Caption": "Delphi RAD yaklaşımıyla tarayıcıda tasarlandı; Python BuildService Jinja2 şablonlarıyla derledi, veriler güvenli backend proxy üzerinden geldi."},
                ),
                C("TButton", "btnTamam", {**B(288, 166, 88, 30), "Caption": "Tamam", "Default": True, "Cancel": True, "ModalResult": 1, "TabOrder": 0}),
            ],
        ),
    }


FORM2_CODE = """// Form2.ts — Hakkında penceresi. btnTamam.ModalResult = mrOk olduğu için ek kod gerekmez.
"""


def form3_design() -> dict[str, Any]:
    return {
        "format": "jsd-design",
        "version": 1,
        "form": C(
            "TForm",
            "Form3",
            {"Caption": "Siparişler (ana-detay)", "ClientWidth": 720, "ClientHeight": 440, "Position": "poMainFormCenter"},
            None,
            [
                C("TLabel", "lblMusteriler", {**B(12, 12, 60, 15), "Caption": "Müşteriler", "Font": {"Name": "Segoe UI", "Size": 9, "Color": "clWindowText", "Style": ["fsBold"]}, "ParentFont": False}),
                C("TLabel", "lblSiparisler", {**B(352, 12, 124, 15), "Caption": "Seçili müşterinin siparişleri", "Font": {"Name": "Segoe UI", "Size": 9, "Color": "clWindowText", "Style": ["fsBold"]}, "ParentFont": False}),
                C(
                    "TDBGrid",
                    "grdMusteri",
                    {
                        **B(12, 34, 328, 394),
                        "Anchors": ["akLeft", "akTop", "akBottom"],
                        "DataSource": "dsMusteri",
                        "ReadOnly": True,
                        "Options": ["dgTitles", "dgIndicator", "dgColLines", "dgRowLines", "dgRowSelect", "dgStriped"],
                        "Columns": [
                            {"FieldName": "ad", "Title": "Ad", "Width": 96},
                            {"FieldName": "soyad", "Title": "Soyad", "Width": 104},
                            {"FieldName": "sehir", "Title": "Şehir", "Width": 96},
                        ],
                        "TabOrder": 0,
                    },
                ),
                C(
                    "TDBGrid",
                    "grdSiparis",
                    {
                        **B(352, 34, 356, 358),
                        "Anchors": ANCHOR_ALL,
                        "DataSource": "dsSiparis",
                        "Columns": [
                            {"FieldName": "urun", "Title": "Ürün", "Width": 120},
                            {"FieldName": "adet", "Title": "Adet", "Width": 50, "Alignment": "taRightJustify"},
                            {"FieldName": "tutar", "Title": "Tutar", "Width": 80, "Alignment": "taRightJustify", "DisplayFormat": "#,##0.00"},
                            {"FieldName": "tarih", "Title": "Tarih", "Width": 86},
                        ],
                        "TabOrder": 1,
                    },
                ),
                C("TDBNavigator", "navSiparis", {**B(352, 400, 356, 28), "Anchors": ["akLeft", "akRight", "akBottom"], "DataSource": "dsSiparis"}),
                C("TConnection", "Connection1", {"ConnectionDefName": "DemoDB", "DesignLeft": 240, "DesignTop": 300}),
                C(
                    "TTable",
                    "tblMusteri",
                    {"Connection": "Connection1", "TableName": "musteriler", "IndexFieldNames": "ad;soyad", "ReadOnly": True, "Active": True, "DesignLeft": 240, "DesignTop": 356},
                ),
                C("TDataSource", "dsMusteri", {"DataSet": "tblMusteri", "DesignLeft": 296, "DesignTop": 356}),
                C(
                    "TTable",
                    "tblSiparis",
                    {
                        "Connection": "Connection1",
                        "TableName": "siparisler",
                        "IndexFieldNames": "-tarih",
                        "MasterSource": "dsMusteri",
                        "MasterFields": "musteri_id=id",
                        "Active": True,
                        "DesignLeft": 240,
                        "DesignTop": 412,
                    },
                ),
                C("TDataSource", "dsSiparis", {"DataSet": "tblSiparis", "DesignLeft": 296, "DesignTop": 412}),
            ],
        ),
    }


FORM3_CODE = """// Form3.ts — TTable ana-detay örneği: tblSiparis.MasterSource = dsMusteri,
// MasterFields = 'musteri_id=id'. Kayıt ekleme/düzenleme DBNavigator ile yapılır;
// değişiklikler parametreli tablo API'si üzerinden sunucuya yazılır.
"""

CUSTOMERS = [
    ("Ayşe", "Yılmaz", "Ankara", "ayse.yilmaz@example.com", 1250.50, 1, "2025-11-02"),
    ("Mehmet", "Kaya", "İstanbul", "mehmet.kaya@example.com", 8420.00, 1, "2025-10-18"),
    ("Zeynep", "Demir", "İzmir", "zeynep.demir@example.com", 310.75, 1, "2026-01-09"),
    ("Mustafa", "Çelik", "Bursa", "mustafa.celik@example.com", 0.0, 0, "2025-07-21"),
    ("Elif", "Şahin", "Ankara", "elif.sahin@example.com", 4580.20, 1, "2026-02-14"),
    ("Ahmet", "Yıldız", "Antalya", "ahmet.yildiz@example.com", 1975.00, 1, "2025-12-01"),
    ("Fatma", "Öztürk", "Konya", "fatma.ozturk@example.com", 725.40, 1, "2026-03-03"),
    ("Emre", "Aydın", "İstanbul", "emre.aydin@example.com", 15320.90, 1, "2025-09-12"),
    ("Merve", "Arslan", "Eskişehir", "merve.arslan@example.com", 96.00, 0, "2026-04-22"),
    ("Burak", "Doğan", "Trabzon", "burak.dogan@example.com", 2210.35, 1, "2026-05-30"),
    ("Selin", "Koç", "İzmir", "selin.koc@example.com", 5140.00, 1, "2026-06-11"),
    ("Can", "Kurt", "Ankara", "can.kurt@example.com", 640.10, 1, "2026-07-07"),
    ("Deniz", "Özdemir", "Antalya", "deniz.ozdemir@example.com", 3890.60, 1, "2026-08-19"),
    ("Hakan", "Aslan", "Bursa", "hakan.aslan@example.com", 1180.00, 1, "2026-09-01"),
]

ORDERS = [
    (1, "Dizüstü bilgisayar", 1, 32999.00, "2026-02-03"), (1, "Kablosuz fare", 2, 899.80, "2026-03-11"),
    (2, "Ofis koltuğu", 4, 27960.00, "2026-01-22"), (2, "Toplantı masası", 1, 18450.00, "2026-02-17"),
    (2, "Projeksiyon", 1, 21500.00, "2026-05-05"), (3, "Monitör 27\"", 2, 17998.00, "2026-04-09"),
    (4, "Klavye", 1, 1249.90, "2025-08-01"), (5, "Tablet", 1, 14999.00, "2026-03-28"),
    (5, "Kulaklık", 3, 5397.00, "2026-06-02"), (6, "Yazıcı", 1, 6750.00, "2026-01-15"),
    (6, "Toner", 4, 3196.00, "2026-02-20"), (7, "Harici disk 2TB", 2, 5198.00, "2026-04-30"),
    (8, "Sunucu", 1, 184000.00, "2025-10-02"), (8, "UPS", 2, 23980.00, "2025-10-02"),
    (8, "Ağ anahtarı", 3, 20970.00, "2025-11-14"), (9, "Web kamerası", 1, 1899.00, "2026-05-02"),
    (10, "Telefon", 2, 51998.00, "2026-06-30"), (11, "Çizim tableti", 1, 8999.00, "2026-07-12"),
    (11, "Kalem seti", 5, 1245.00, "2026-07-12"), (12, "USB bellek", 10, 2490.00, "2026-08-08"),
    (13, "Akıllı saat", 1, 9999.00, "2026-08-25"), (14, "Masa lambası", 2, 1580.00, "2026-09-05"),
]


def create_demo_database(project_id: str) -> str:
    """Creates projects/<id>/data/demo.sqlite (idempotent) and returns its relative name."""
    path = files.data_dir(project_id) / "demo.sqlite"
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    try:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS musteriler (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              ad VARCHAR(50) NOT NULL,
              soyad VARCHAR(50) NOT NULL,
              sehir VARCHAR(40),
              email VARCHAR(120),
              bakiye NUMERIC(12, 2) DEFAULT 0,
              aktif BOOLEAN DEFAULT 1,
              kayit_tarihi DATE
            );
            CREATE TABLE IF NOT EXISTS siparisler (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              musteri_id INTEGER NOT NULL REFERENCES musteriler(id),
              urun VARCHAR(80) NOT NULL,
              adet INTEGER NOT NULL DEFAULT 1,
              tutar NUMERIC(12, 2) NOT NULL,
              tarih DATE
            );
            CREATE INDEX IF NOT EXISTS ix_musteriler_sehir ON musteriler(sehir);
            CREATE INDEX IF NOT EXISTS ix_siparisler_musteri ON siparisler(musteri_id);
            """
        )
        if con.execute("SELECT COUNT(*) FROM musteriler").fetchone()[0] == 0:
            con.executemany(
                "INSERT INTO musteriler (ad, soyad, sehir, email, bakiye, aktif, kayit_tarihi) VALUES (?, ?, ?, ?, ?, ?, ?)", CUSTOMERS
            )
            con.executemany("INSERT INTO siparisler (musteri_id, urun, adet, tutar, tarih) VALUES (?, ?, ?, ?, ?)", ORDERS)
        con.commit()
    finally:
        con.close()
    return "demo.sqlite"


def populate_demo_project(db: Session, project: Project, user: User) -> None:
    from backend.services.data.connection_manager import ConnectionIn, create_connection
    from backend.services.project_service import projects

    project.title = project.title if project.title and project.title != project.name else "Müşteri Takip"
    project.description = project.description or "TQuery, TTable (ana-detay), TDBGrid ve modal form içeren örnek proje."
    database = create_demo_database(project.id)
    create_connection(db, project, ConnectionIn(project_id=project.id, name="DemoDB", driver="sqlite", database=database))
    for name, design, code in (("Form1", form1_design(), FORM1_CODE), ("Form2", form2_design(), FORM2_CODE), ("Form3", form3_design(), FORM3_CODE)):
        form = projects.create_form(db, project, user, FormCreate(name=name, design=design, code=code, code_js=code))
        if name != "Form1":
            form.auto_create = False
    project.main_form = "Form1"


def ensure_demo_content() -> None:
    """First start: create the dev user and a built demo project."""
    from backend.services.build_service import builder
    from backend.services.project_service import projects

    if not settings.dev_login:
        return
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.username == "developer"))
        if user is None:
            user = User(username="developer", display_name="Geliştirici", color="#4fc1ff")
            db.add(user)
            db.commit()
        if db.scalar(select(Project).where(Project.owner_id == user.id)) is not None:
            return
        project = projects.create_project(db, user, ProjectCreate(name="MusteriTakip", title="Müşteri Takip", template="demo"))
        result = builder.build(db, project, user)
        log.info("demo project %s created (build ok=%s)", project.id, result.ok)
    finally:
        db.close()
