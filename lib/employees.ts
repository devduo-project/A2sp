export const employees = [
  "Андрей Лапшинов",
  "Леонид Случевский",
  "Игорь Токарев",
  "Алексей Тютюнков",
  "Ринат Желетдинов",
  "Игорь Боблак",
] as const

export type Employee = (typeof employees)[number]

export const [lapshinov, sluchevsky, tokarev, tyutyunkov, zheletdinov, boblak] = employees
