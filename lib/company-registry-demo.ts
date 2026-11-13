import type { DemoCompany, RegistryContact, RegistryRecord } from "@/lib/company-registry-data"

const contact = (
  id: string,
  name: string,
  role: string,
  phone: string,
  email: string,
  isPrimary = false,
  comment?: string,
): RegistryContact => ({
  id,
  name,
  role,
  phones: [phone],
  emails: [email],
  isPrimary,
  comment,
})

const lead = (id: string, name: string, stage: string, createdAt: string, amount: number, direction = "А2-СП"): RegistryRecord => ({
  id,
  name,
  stage,
  createdAt,
  amount,
  direction,
})

const deal = (id: string, name: string, stage: string, createdAt: string, amount: number): RegistryRecord => ({
  id,
  name,
  stage,
  createdAt,
  amount,
})

export const demoCompanies: DemoCompany[] = [
  {
    id: "demo-company-north",
    legalName: "ООО «Северный квартал»",
    contacts: [
      contact("demo-contact-anna", "Анна Мельникова", "Директор по развитию", "+7 921 555-19-40", "anna@severny-kvartal.ru", true),
      contact("demo-contact-pavel", "Павел Соколов", "Главный инженер", "+7 921 555-20-11", "pavel@severny-kvartal.ru"),
    ],
    leads: [lead("demo-lead-1", "Жилой комплекс «Северный»", "Полевые работы", "2024-10-12", 980000)],
    deals: [deal("demo-deal-1", "Обследование здания", "Коммерческая", "2024-11-02", 3200000)],
    createdAt: "2024-08-10",
    createdBy: "Олег Токарев",
    leadAmount: 980000,
    contractAmount: 3200000,
    customerDebt: 250000,
    direction: "А2-СП",
  },
  {
    id: "demo-company-river",
    legalName: "ГК «Речной порт»",
    contacts: [contact("demo-contact-maxim", "Максим Орлов", "Руководитель проектов", "+7 916 320-44-81", "maxim@riverport.ru", true)],
    leads: [],
    deals: [deal("demo-deal-2", "Расчёт конструкций", "Согласование результата", "2024-09-15", 1840000)],
    createdAt: "2024-07-20",
    createdBy: "Максим Лапшинов",
    contractAmount: 1840000,
    direction: "ИП",
  },
  {
    id: "demo-company-stone",
    legalName: "«Каменный берег»",
    contacts: [contact("demo-contact-igor", "Игорь Соколов", "Начальник отдела строительства", "+7 812 777-45-67", "igor@kamennyy-bereg.ru", true)],
    leads: [],
    deals: [deal("demo-deal-3", "Техническое обследование", "Камеральные работы", "2024-09-02", 980000)],
    createdAt: "2024-06-15",
    createdBy: "Иван Бобляк",
    contractAmount: 980000,
    customerDebt: 0,
    direction: "МГСУ",
  },
  {
    id: "demo-company-mega",
    legalName: "ООО «Мегастройка»",
    contacts: [
      contact("demo-contact-dmitry", "Дмитрий Петров", "Генеральный директор", "+7 921 666-33-22", "dmitriy@megastroyka.ru", true),
      contact("demo-contact-elena", "Елена Волкова", "Заместитель генерального директора", "+7 921 666-33-23", "elena@megastroyka.ru"),
      contact("demo-contact-sergey", "Сергей Кузнецов", "Руководитель проектов", "+7 921 666-33-24", "sergey@megastroyka.ru"),
    ],
    leads: [
      lead("demo-lead-2", "Торгово-офисный центр", "Камеральные работы", "2024-09-20", 1250000),
      lead("demo-lead-3", "Жилой комплекс на набережной", "Новый лид", "2024-10-05", 850000, "ИП"),
    ],
    deals: [],
    createdAt: "2024-05-10",
    createdBy: "Олег Токарев",
    leadAmount: 1250000,
    direction: "А2-СП",
  },
  {
    id: "demo-company-builder",
    legalName: "ПАО «Строитель»",
    contacts: [contact("demo-contact-viktor", "Виктор Волков", "Главный инженер", "+7 812 555-88-99", "viktor@stroitel.ru", true)],
    leads: [lead("demo-lead-4", "Многоэтажный жилой дом", "Полевые работы", "2024-08-30", 650000)],
    deals: [],
    createdAt: "2024-04-05",
    createdBy: "Максим Лапшинов",
    leadAmount: 650000,
    direction: "А2-СП",
  },
  {
    id: "demo-company-engineering",
    legalName: "ООО «Инженерные решения»",
    contacts: [contact("demo-contact-natalia", "Наталья Иванова", "Директор", "+7 921 444-55-66", "natalya@inzhen-solutions.ru", true)],
    leads: [],
    deals: [],
    createdAt: "2024-03-12",
    createdBy: "Иван Бобляк",
    direction: "МГСУ",
  },
  {
    id: "demo-company-architecture",
    legalName: "ООО «Архитектурное бюро»",
    contacts: [
      contact("demo-contact-konstantin", "Константин Архипов", "Генеральный директор", "+7 812 777-00-11", "konstantin@archi-bureau.ru", true),
      contact("demo-contact-alexey", "Алексей Беляев", "Главный архитектор", "+7 812 777-00-12", "alexey@archi-bureau.ru"),
    ],
    leads: [lead("demo-lead-5", "Культурный центр", "Камеральные работы", "2024-09-25", 2100000)],
    deals: [],
    createdAt: "2024-02-20",
    createdBy: "Олег Токарев",
    leadAmount: 2100000,
    direction: "А2-СП",
  },
]

export const demoCreators = ["Олег Токарев", "Максим Лапшинов", "Иван Бобляк"]
