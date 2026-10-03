import { supabase, PROCESS_LABELS, MATERIAL_LABELS, PROCESS_ORDER, type Material, type ProcessType } from '@/lib/supabase';

export interface AiHelpInput {
  title: string;
  description: string;
  material: Material;
  quantity: number;
  operations: ProcessType[];
  drawingPath: string | null;
  drawingName: string | null;
}

export interface AiHelpResult {
  operations: { code: ProcessType; reason: string }[];
  spec: string;
  questions: string[];
  notes: string;
  source: 'ai' | 'local';
  notice?: string;
}

const RULES: { re: RegExp; ops: ProcessType[]; reason: string }[] = [
  {
    re: /корпус|короб|шкаф|щит|ящик|кожух|контейнер|бункер|шкафчик/i,
    ops: ['cutting', 'bending', 'welding', 'painting'],
    reason: 'Корпусные изделия обычно вырезают из листа, гнут, сваривают и красят.',
  },
  {
    re: /кронштейн|уголок|планк|накладк|скоб|петл/i,
    ops: ['cutting', 'bending'],
    reason: 'Детали такого типа вырезают из листа и сгибают.',
  },
  {
    re: /пластин|шайб|фланец|прокладк|заглушк|лист/i,
    ops: ['cutting'],
    reason: 'Плоские детали вырезают лазером из листа.',
  },
  {
    re: /ограждени|забор|ворота|калитк|перил|решётк|решетк|лестниц|навес|козыр|площадк/i,
    ops: ['cutting', 'welding', 'painting', 'installation'],
    reason: 'Конструкции такого типа режут, сваривают, красят и монтируют на объекте.',
  },
  {
    re: /каркас|ферм|стеллаж|рам[аы]|подставк|стойк|мангал|станин/i,
    ops: ['cutting', 'welding', 'painting'],
    reason: 'Сварные каркасные изделия режут, сваривают и защищают покрытием.',
  },
  {
    re: /вал\b|втулк|шестерн|ось\b|фрез|токар|резьб|подшипник|муфт/i,
    ops: ['machining'],
    reason: 'Тела вращения и точные детали делают на токарных и фрезерных станках.',
  },
  { re: /покраск|окраск|порошк|ral\b/i, ops: ['painting'], reason: 'В описании упомянута покраска.' },
  { re: /монтаж|установк|смонтир/i, ops: ['installation'], reason: 'В описании упомянут монтаж.' },
  { re: /гибк|гнуть|согнут|изогн|гнут/i, ops: ['bending'], reason: 'В описании упомянута гибка.' },
  { re: /сварк|сварн|приварить/i, ops: ['welding'], reason: 'В описании упомянута сварка.' },
  { re: /резк|вырез|лазер|раскро/i, ops: ['cutting'], reason: 'В описании упомянута резка.' },
];

export function suggestOperationsLocal(text: string): { code: ProcessType; reason: string }[] {
  const found = new Map<ProcessType, string>();
  for (const r of RULES) {
    if (r.re.test(text)) {
      for (const op of r.ops) if (!found.has(op)) found.set(op, r.reason);
    }
  }
  if (found.size === 0) found.set('cutting', 'Не удалось определить тип изделия по описанию — начните с резки и уточните у исполнителя.');
  return PROCESS_ORDER.filter((p) => found.has(p)).map((p) => ({ code: p, reason: found.get(p)! }));
}

const QUESTIONS: Record<ProcessType, string[]> = {
  cutting: ['Толщина и марка металла (например, Ст3, AISI 304)?', 'Нужна ли зачистка кромок и снятие заусенцев?'],
  bending: ['Какие углы и радиусы гибки, какие допуски?', 'Есть ли требования к направлению прокатки металла?'],
  welding: ['Тип сварки (полуавтомат, аргон) и требования к швам: сплошной или прерывистый?', 'Нужна ли зачистка и шлифовка швов?'],
  painting: ['Цвет по RAL, глянец или муар?', 'Нужна ли грунтовка и какая минимальная толщина покрытия?'],
  installation: ['Адрес и условия объекта, нужен ли выезд мастеров?', 'Кто предоставляет крепёж и подъёмные механизмы?'],
  machining: ['Требуемые квалитеты точности и шероховатость?', 'Нужна ли термообработка и контроль размеров?'],
};

export function buildLocalSpec(i: AiHelpInput): { spec: string; questions: string[] } {
  const ops = i.operations.length > 0 ? i.operations : suggestOperationsLocal(`${i.title} ${i.description}`).map((o) => o.code);
  const questions = Array.from(new Set(ops.flatMap((o) => QUESTIONS[o]))).concat([
    'Желаемые сроки изготовления?',
    'Нужен ли сертификат на материал и упаковка для перевозки?',
  ]);
  const spec =
    `ТЕХНИЧЕСКОЕ ЗАДАНИЕ\n` +
    `Изделие: ${i.title || '—'}\n` +
    `Количество: ${i.quantity} шт.\n` +
    `Материал: ${MATERIAL_LABELS[i.material]} (толщина и марка — уточнить)\n` +
    `Требуемые операции:\n${ops.map((o, n) => `  ${n + 1}. ${PROCESS_LABELS[o]}`).join('\n')}\n` +
    `Чертёж: ${i.drawingName ?? 'не приложен'}\n` +
    `Описание от заказчика: ${i.description || '—'}\n\n` +
    `Исполнителю необходимо уточнить:\n${questions.map((q) => `  • ${q}`).join('\n')}\n\n` +
    `ТЗ носит предварительный характер: итоговые требования согласуются между заказчиком и исполнителем.`;
  return { spec, questions };
}

function localResult(i: AiHelpInput, notice: string): AiHelpResult {
  const operations = suggestOperationsLocal(`${i.title} ${i.description}`);
  const { spec, questions } = buildLocalSpec({ ...i, operations: operations.map((o) => o.code) });
  return { operations, spec, questions, notes: '', source: 'local', notice };
}

export async function requestAiHelp(i: AiHelpInput): Promise<AiHelpResult> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-spec', {
      body: {
        title: i.title,
        description: i.description,
        material: i.material,
        quantity: i.quantity,
        operations: i.operations,
        drawing_path: i.drawingPath,
        drawing_name: i.drawingName,
      },
    });
    if (error || !data || data.error || !data.spec) {
      const limit = data?.error === 'LIMIT';
      return localResult(
        i,
        limit
          ? 'Дневной лимит ИИ-подсказок исчерпан. Мы подготовили шаблон ТЗ по вашим данным.'
          : 'ИИ-помощник сейчас недоступен. Мы подготовили шаблон ТЗ и подбор операций по вашему описанию.'
      );
    }
    return {
      operations: (data.operations ?? []) as { code: ProcessType; reason: string }[],
      spec: String(data.spec),
      questions: (data.questions ?? []) as string[],
      notes: String(data.notes ?? ''),
      source: 'ai',
    };
  } catch {
    return localResult(i, 'ИИ-помощник сейчас недоступен. Мы подготовили шаблон ТЗ и подбор операций по вашему описанию.');
  }
}
