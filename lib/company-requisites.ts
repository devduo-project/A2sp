import type { CompanyViewModel } from "./company-registry-data";

export type Values = Record<string, string>;
export type Row = { id: string; values: Values };
export type List = "activities" | "accounts" | "licenses";
export type Profile = {
  values: Values;
  lists: Record<List, Row[]>;
  filename: string;
  matched: boolean;
};
export const entity = "Юридическое лицо";
export const individual = "Индивидуальный предприниматель";
export const labels: Values = {
  type: "Тип компании",
  full: "Полное наименование организации",
  short: "Сокращённое наименование",
  form: "Организационно-правовая форма",
  inn: "ИНН",
  kpp: "КПП",
  ogrn: "ОГРН",
  ogrnip: "ОГРНИП",
  legal: "Юридический адрес",
  actual: "Фактический адрес",
  phone: "Телефон",
  fax: "Факс",
  email: "Email",
  site: "Сайт",
  director: "Генеральный директор",
  position: "Должность руководителя",
  owner: "ФИО предпринимателя",
  taxDate: "Дата постановки на налоговый учёт",
  taxPlace: "Место постановки на налоговый учёт",
  taxOffice: "Наименование налогового органа",
  taxAddress: "Адрес налогового органа",
  largest:
    "Сведения о постановке на учёт в качестве крупнейшего налогоплательщика",
  largestDate: "Дата постановки на учёт крупнейшего налогоплательщика",
  largestOffice:
    "Налоговый орган, осуществивший постановку на учёт крупнейшего налогоплательщика",
  regNumber: "Регистрационный номер",
  assigned: "Дата присвоения ОГРН",
  entered: "Дата внесения записи в ЕГРЮЛ",
  registrar: "Регистрирующий орган",
  certificate: "Номер свидетельства о государственной регистрации",
  series: "Серия свидетельства",
  issued: "Дата выдачи свидетельства",
  regNote: "Дополнительные сведения о государственной регистрации",
  okpo: "ОКПО",
  oktmo: "ОКТМО",
  okfs: "ОКФС",
  okopf: "ОКОПФ",
  code: "Код ОКВЭД",
  activity: "Наименование вида деятельности",
  category: "Признак",
  authority: "Основание полномочий",
  authorityNote: "Дополнительная информация об основании полномочий",
  accountant: "ФИО главного бухгалтера",
  accountantContact: "Контактные данные главного бухгалтера",
  bank: "Наименование банка",
  bik: "БИК",
  account: "Расчётный счёт",
  correspondent: "Корреспондентский счёт",
  location: "Место нахождения банка",
  note: "Дополнительная информация",
  license: "Наименование лицензии",
  number: "Регистрационный номер лицензии",
  date: "Дата выдачи",
  issuer: "Лицензирующий орган",
  validity: "Срок действия",
  status: "Статус действия лицензии",
};
export function basic(ip: boolean) {
  return [
    "type",
    "full",
    "short",
    "form",
    "inn",
    ...(ip ? ["ogrnip"] : ["kpp", "ogrn"]),
    "legal",
    "actual",
    "phone",
    "fax",
    "email",
    "site",
    ...(ip ? ["owner"] : ["director", "position"]),
  ];
}
export const specialTax = ["largest", "largestDate", "largestOffice"];
export function sections(
  ip: boolean,
): { id: string; title: string; fields: string[]; list?: List }[] {
  return [
    {
      id: "tax",
      title: "Налоговый учёт",
      fields: ["taxDate", "taxPlace", "taxOffice", "taxAddress"],
    },
    {
      id: "registration",
      title: "Сведения о государственной регистрации",
      fields: [
        "regNumber",
        "assigned",
        "entered",
        "registrar",
        "certificate",
        "series",
        "issued",
        "regNote",
      ],
    },
    {
      id: "classification",
      title: "Классификационные коды",
      fields: ["okpo", "oktmo", "okfs", "okopf"],
      list: "activities",
    },
    {
      id: "management",
      title: "Руководство и полномочия",
      fields: [
        ...(ip ? ["owner"] : ["director", "position"]),
        "authority",
        "authorityNote",
        "accountant",
        "accountantContact",
      ],
    },
    {
      id: "banking",
      title: "Банковские реквизиты",
      fields: [],
      list: "accounts",
    },
    {
      id: "licensing",
      title: "Лицензии и разрешительные документы",
      fields: [],
      list: "licenses",
    },
  ];
}
export const lists = {
  activities: {
    title: "ОКВЭД",
    add: "Добавить код ОКВЭД",
    fields: ["code", "activity", "category"],
  },
  accounts: {
    title: "Банковский счёт",
    add: "Добавить банковские реквизиты",
    fields: ["bank", "bik", "account", "correspondent", "location", "note"],
  },
  licenses: {
    title: "Лицензия",
    add: "Добавить лицензию",
    fields: [
      "license",
      "number",
      "date",
      "issuer",
      "validity",
      "status",
      "note",
    ],
  },
};
export function fromCompany(company: CompanyViewModel): Profile {
  const methods = (kind: "phone" | "email") =>
    company.contactMethods
      .filter((m) => m.kind === kind)
      .map((m) => m.value)
      .join(", ");
  return {
    values: {
      full: company.legalName,
      type: /^(ИП\s|Индивидуальный предприниматель)/iu.test(company.legalName)
        ? individual
        : entity,
      phone: methods("phone"),
      email: methods("email"),
    },
    lists: { activities: [], accounts: [], licenses: [] },
    filename: "",
    matched: false,
  };
}
type Sample = { values: Values; lists?: Partial<Record<List, Values[]>> };
// Filename-selected training fixtures; none of the identifiers represent verified CRM data.
const samples: [RegExp, Sample][] = [
  [
    /водоканал|vodokanal/i,
    {
      values: {
        type: entity,
        full: "Акционерное общество «Водоканал»",
        short: "АО «Водоканал»",
        form: "Акционерное общество",
        inn: "0000000001",
        kpp: "000001001",
        ogrn: "0000000000001",
        taxDate: "15.04.2004",
        taxOffice: "Территориальная инспекция ФНС (учебный пример)",
        assigned: "15.04.2004",
        certificate: "000001",
        series: "00",
        okfs: "16",
        okopf: "12267",
      },
      lists: {
        activities: [
          {
            code: "36.00",
            activity: "Забор, очистка и распределение воды",
            category: "Основной",
          },
          {
            code: "37.00",
            activity: "Сбор и обработка сточных вод",
            category: "Дополнительный",
          },
        ],
      },
    },
  ],
  [
    /авилон|avilon/i,
    {
      values: {
        type: entity,
        full: "Акционерное общество «Авилон Автомобильная Группа»",
        short: "АО «Авилон Автомобильная Группа»",
        form: "Акционерное общество",
        authority: "На основании доверенности",
        authorityNote: "Доверенность № ДЕМО-02",
        position: "Генеральный директор",
      },
      lists: {
        accounts: [
          {
            bank: "Учебный банк А",
            bik: "000000001",
            account: "00000000000000000001",
            correspondent: "00000000000000000003",
          },
          {
            bank: "Учебный банк Б",
            bik: "000000002",
            account: "00000000000000000002",
          },
        ],
      },
    },
  ],
  [
    /фармстандарт|pharmstandard|farmstandart/i,
    {
      values: {
        type: entity,
        full: "Акционерное общество «Фармстандарт»",
        short: "АО «Фармстандарт»",
        form: "Акционерное общество",
        okpo: "00000003",
        authority: "На основании решения / протокола",
      },
      lists: {
        licenses: [
          {
            license: "Фармацевтическая деятельность",
            number: "ДЕМО-ФМ-001",
            date: "12.05.2021",
            issuer: "Росздравнадзор (учебный пример)",
            validity: "Бессрочная",
            status: "Действует",
          },
        ],
      },
    },
  ],
];
export const recognize = (filename: string) =>
  samples.find(([pattern]) => pattern.test(filename.normalize("NFC")))?.[1];
