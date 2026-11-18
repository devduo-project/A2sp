"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileUp, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  basic,
  entity,
  individual,
  labels,
  lists,
  recognize,
  sections,
  specialTax,
  type List,
  type Profile,
  type Values,
} from "@/lib/company-requisites";
import type { CompanyViewModel } from "@/lib/company-registry-data";

const wide = new Set([
  "full",
  "short",
  "legal",
  "actual",
  "taxAddress",
  "regNote",
  "authorityNote",
  "note",
  "largest",
  "largestOffice",
  "activity",
]);
const reviewMessage =
  "Реквизиты распознаны. Проверьте данные перед сохранением";
function Fields({
  keys,
  values,
  edit,
  marked,
  change,
  overrides = {},
}: {
  keys: string[];
  values: Values;
  edit: boolean;
  marked: string[];
  change: (key: string, value: string) => void;
  overrides?: Values;
}) {
  const prefix = useId();
  return (
    <div className="grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-2">
      {keys.map((key) => {
        const id = `${prefix}-${key}`,
          label = overrides[key] || labels[key],
          value = values[key] || "";
        const options =
          key === "type"
            ? [entity, individual]
            : key === "category"
              ? ["Основной", "Дополнительный"]
              : null;
        return (
          <Field
            key={key}
            className={`${wide.has(key) ? "sm:col-span-2 " : ""}min-w-0 gap-1 ${marked.includes(key) ? "rounded-md bg-primary/5 px-2" : ""}`}
          >
            {edit ? (
              <>
                <FieldLabel
                  htmlFor={id}
                  className="text-xs text-muted-foreground"
                >
                  {label}
                </FieldLabel>
                {options ? (
                  <select
                    id={id}
                    value={value}
                    onChange={(e) => change(key, e.target.value)}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    {!value && <option value="">Не указано</option>}
                    {options.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={id}
                    value={value}
                    onChange={(e) => change(key, e.target.value)}
                  />
                )}
              </>
            ) : (
              <>
                <span data-slot="field-label" className="text-xs">{label}</span>
                <span className="break-words text-sm font-medium">
                  {value || "—"}
                </span>
              </>
            )}
          </Field>
        );
      })}
    </div>
  );
}

export function RequisitesCard({
  company,
  initial,
  save,
  close,
}: {
  company: CompanyViewModel;
  initial: Profile;
  save: (p: Profile) => void;
  close: () => void;
}) {
  const [draft, setDraft] = useState(initial),
    [edit, setEdit] = useState(false),
    [expanded, setExpanded] = useState<string[]>(["banking"]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false),
    [marked, setMarked] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    input = useRef<HTMLInputElement>(null);
  const beforeUpload = useRef<Profile | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const ip = draft.values.type === individual;
  function reset() {
    clearTimeout(timer.current);
    beforeUpload.current = null;
    setDraft(initial);
    setEdit(false);
    setMarked([]);
    setBusy(false);
    setError("");
  }
  function upload(file?: File) {
    if (!file) return;
    if (!/\.(pdf|docx?|jpe?g|png)$/i.test(file.name)) {
      setError("Выберите файл PDF, DOC, DOCX, JPG или PNG.");
      return;
    }
    clearTimeout(timer.current);
    const base = beforeUpload.current ?? draft;
    beforeUpload.current = base;
    setError("");
    setEdit(true);
    setBusy(true);
    setMarked([]);
    setDraft({ ...base, filename: file.name, matched: false });
    timer.current = setTimeout(() => {
      const sample = recognize(file.name);
      if (sample) {
        const next: Profile = {
          ...base,
          filename: file.name,
          matched: true,
          values: { ...base.values, ...sample.values },
          lists: { ...base.lists },
        };
        const highlights = Object.keys(sample.values);
        for (const key of Object.keys(sample.lists ?? {}) as List[]) {
          next.lists[key] = sample.lists![key]!.map((values) => {
            const id = crypto.randomUUID();
            highlights.push(...Object.keys(values).map((k) => `${id}:${k}`));
            return { id, values: { ...values } };
          });
        }
        setDraft(next);
        setMarked(highlights);
        const populated = sections(next.values.type === individual)
          .filter(
            (s) =>
              [...s.fields, ...(s.id === "tax" ? specialTax : [])].some(
                (k) => k in sample.values,
              ) ||
              (s.list && sample.lists?.[s.list]),
          )
          .map((s) => s.id);
        setExpanded((prev) => [...new Set([...prev, ...populated])]);
      }
      setBusy(false);
    }, 850);
  }
  function modify(p: Profile, key?: string) {
    beforeUpload.current = null;
    setDraft(p);
    if (key) setMarked((prev) => prev.filter((k) => k !== key));
  }
  const fields = (keys: string[], overrides?: Values) => (
    <Fields
      keys={keys}
      overrides={overrides}
      values={draft.values}
      edit={edit}
      marked={marked}
      change={(k, v) =>
        modify({ ...draft, values: { ...draft.values, [k]: v } }, k)
      }
    />
  );
  function collection(key: List) {
    const rows = draft.lists[key],
      spec = lists[key];
    const update = (items: typeof rows, k?: string) =>
      modify({ ...draft, lists: { ...draft.lists, [key]: items } }, k);
    return (
      <div className="flex flex-col gap-3">
        {rows.map(({ id, values }, index) => (
          <section key={id} className="rounded-lg border bg-background/40 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                {spec.title} · {index + 1}
              </h4>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`${edit ? "Удалить" : "Изменить"}: ${spec.title} ${index + 1}`}
                onClick={() =>
                  edit ? update(rows.filter((r) => r.id !== id)) : setEdit(true)
                }
              >
                {edit ? <Trash2 /> : <Pencil />}
              </Button>
            </div>
            <Fields
              keys={spec.fields}
              edit={edit}
              values={values}
              marked={marked
                .filter((k) => k.startsWith(id + ":"))
                .map((k) => k.slice(id.length + 1))}
              change={(k, v) =>
                update(
                  rows.map((r) =>
                    r.id === id ? { ...r, values: { ...values, [k]: v } } : r,
                  ),
                  `${id}:${k}`,
                )
              }
            />
          </section>
        ))}
        {!rows.length && (key === "accounts" ? (
          <Fields
            keys={spec.fields}
            edit={false}
            values={{}}
            marked={[]}
            change={() => {}}

          />
        ) : (
          <p className="text-sm text-muted-foreground">Нет данных</p>
        ))}
        {edit && (
          <Button
            className="self-start"
            size="sm"
            variant="outline"
            onClick={() =>
              update([...rows, { id: crypto.randomUUID(), values: {} }])
            }
          >
            <Plus />
            {spec.add}
          </Button>
        )}
      </div>
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="registry-dialog company-requisites-dialog flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <p className="section-label">Карточка компании</p>
          <DialogTitle className="break-words">
            {initial.values.full || company.legalName}
          </DialogTitle>
          <DialogDescription>
            Запись CRM: {company.legalName}. Изменения реквизитов сохраняются
            только в текущем сеансе.
          </DialogDescription>
          {!edit && (
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => setEdit(true)}
            >
              <Pencil />
              Редактировать
            </Button>
          )}
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-5 py-4">
          <section
            className={`rounded-xl border border-dashed p-4 ${drag ? "bg-primary/10" : "bg-background/50"}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              upload(e.dataTransfer.files[0]);
            }}
          >
            <h3 className="font-semibold">Загрузить реквизиты компании</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Прикрепите файл с реквизитами, чтобы автоматически заполнить
              данные компании.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Перетащите PDF, DOC, DOCX, JPG или PNG. В деморежиме имя файла
              выбирает пример: Водоканал, Авилон или Фармстандарт. Содержимое
              файла не отправляется.
            </p>
            <input
              ref={input}
              hidden
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {draft.filename && (
              <p className="mt-2 break-all text-sm font-medium">
                {draft.filename}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => input.current?.click()}
              >
                <FileUp />
                {draft.filename ? "Заменить файл" : "Загрузить документ"}
              </Button>
              {draft.filename && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearTimeout(timer.current);
                    setBusy(false);
                    setEdit(true);
                    setError("");
                    setMarked([]);
                    setDraft({ ...draft, filename: "", matched: false });
                    beforeUpload.current = null;
                  }}
                >
                  Удалить файл
                </Button>
              )}
            </div>
            <p role="status" className="mt-2 flex items-center gap-2 text-xs">
              {busy ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Распознаём реквизиты документа...
                </>
              ) : draft.filename ? (
                draft.matched ? (
                  edit ? (
                    reviewMessage
                  ) : (
                    "Реквизиты распознаны"
                  )
                ) : (
                  "Нет демонстрационного образца для этого файла. Заполните поля вручную."
                )
              ) : null}
            </p>
            {error && <p role="alert">{error}</p>}
          </section>
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
            <section className="rounded-xl border bg-background/60 p-4">
              <h3 className="mb-4 font-semibold">Основные сведения</h3>
              {fields(basic(ip))}
            </section>
            <Accordion
              type="multiple"
              value={expanded}
              onValueChange={setExpanded}
              className="rounded-xl border bg-background/40 px-4"
            >
              {sections(ip).map((s) => (
                <AccordionItem key={s.id} value={s.id}>
                  <AccordionTrigger>{s.title}</AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-4">
                    {s.fields.length > 0 &&
                      fields(
                        s.fields,
                        ip
                          ? {
                              assigned: "Дата присвоения ОГРНИП",
                              entered: "Дата внесения записи в ЕГРИП",
                            }
                          : { director: "ФИО генерального директора" },
                      )}
                    {s.id === "tax" && (
                      <section className="border-t pt-3">
                        <h4 className="mb-3 font-medium">
                          Учёт крупнейшего налогоплательщика
                        </h4>
                        {fields(specialTax)}
                      </section>
                    )}
                    {s.list && collection(s.list)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </fieldset>
          <section className="text-xs text-muted-foreground">
            <h3 className="mb-1 font-semibold">Связи в CRM</h3>
            <p>
              Основной контакт:{" "}
              {company.contacts.find((c) => c.isPrimary)?.name || "—"} · Лиды:{" "}
              {company.leads.length} · Сделки: {company.deals.length} · Создана:{" "}
              {company.createdAt
                ? new Date(company.createdAt).toLocaleDateString("ru-RU")
                : "—"}
            </p>
          </section>
        </div>
        {edit && (
          <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-3">
            <Button variant="outline" onClick={reset}>
              Отмена
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                save(draft);
                setEdit(false);
                setMarked([]);
                setError("");
                beforeUpload.current = null;
              }}
            >
              Сохранить
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
