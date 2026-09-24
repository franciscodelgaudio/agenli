import { describe, it, expect } from "vitest";
import {
  cashFlowBuckets,
  cashFlowFetchRange,
  dailyAppointmentTotalsPipeline,
  dailyBookingForecastPipeline,
  parseCashFlowQuery,
  serviceAppointmentTotalsPipeline,
  serviceBookingForecastPipeline,
  shiftCashFlowDate,
  summarizeCashFlow,
  summarizeServices,
} from "@/lib/cash-flow";
import type { RevenueShare } from "@/lib/revenue-share";

// 24/09/2026 (quinta-feira) às 23:30 em Brasília (já é dia 25 em UTC).
const NOW = new Date("2026-09-25T02:30:00.000Z");

const day = (date: string) => ({ from: date, to: date });

describe("parseCashFlowQuery", () => {
  it("sem parâmetros, mostra o mês de hoje em Brasília", () => {
    expect(parseCashFlowQuery({}, NOW)).toEqual({ view: "month", date: "2026-09-24" });
  });

  it.each(["week", "month", "year"])("aceita a visão %s", (view) => {
    expect(parseCashFlowQuery({ view, date: "2026-03-10" }, NOW)).toEqual({ view, date: "2026-03-10" });
  });

  it("usa o primeiro valor quando o parâmetro vem repetido", () => {
    expect(parseCashFlowQuery({ view: ["year", "week"], date: ["2026-01-05", "2026-02-05"] }, NOW)).toEqual({
      view: "year",
      date: "2026-01-05",
    });
  });

  it.each(["day", "semana", "", "$where"])("volta para o mês quando a visão é %j", (view) => {
    expect(parseCashFlowQuery({ view }, NOW).view).toBe("month");
  });

  it.each(["24/09/2026", "2026-02-30", "hoje"])("volta para hoje quando a data é %s", (date) => {
    expect(parseCashFlowQuery({ date }, NOW).date).toBe("2026-09-24");
  });
});

describe("shiftCashFlowDate", () => {
  it.each([
    ["week", "2026-09-24", 1, "2026-10-01"],
    ["week", "2026-09-24", -1, "2026-09-17"],
    ["week", "2026-12-29", 1, "2027-01-05"],
  ] as const)("visão %s: %s %+d = %s (7 dias por passo)", (view, date, steps, expected) => {
    expect(shiftCashFlowDate({ view, date }, steps)).toBe(expected);
  });

  it.each([
    ["month", "2026-09-24", 1, "2026-10-01"],
    ["month", "2026-01-31", 1, "2026-02-01"],
    ["month", "2026-01-15", -1, "2025-12-01"],
    ["year", "2026-09-24", 1, "2027-01-01"],
    ["year", "2026-09-24", -1, "2025-01-01"],
  ] as const)("visão %s: %s %+d = %s (primeiro dia do período)", (view, date, steps, expected) => {
    expect(shiftCashFlowDate({ view, date }, steps)).toBe(expected);
  });
});

describe("cashFlowBuckets", () => {
  it("semana: um intervalo por dia, de segunda a domingo", () => {
    expect(cashFlowBuckets({ view: "week", date: "2026-09-24" })).toEqual([
      day("2026-09-21"),
      day("2026-09-22"),
      day("2026-09-23"),
      day("2026-09-24"),
      day("2026-09-25"),
      day("2026-09-26"),
      day("2026-09-27"),
    ]);
  });

  it("semana que atravessa a virada do ano", () => {
    const buckets = cashFlowBuckets({ view: "week", date: "2027-01-01" });

    expect(buckets[0]).toEqual(day("2026-12-28"));
    expect(buckets[6]).toEqual(day("2027-01-03"));
  });

  it("mês: semanas de segunda a domingo, cortadas no início e no fim do mês", () => {
    expect(cashFlowBuckets({ view: "month", date: "2026-09-24" })).toEqual([
      { from: "2026-09-01", to: "2026-09-06" },
      { from: "2026-09-07", to: "2026-09-13" },
      { from: "2026-09-14", to: "2026-09-20" },
      { from: "2026-09-21", to: "2026-09-27" },
      { from: "2026-09-28", to: "2026-09-30" },
    ]);
  });

  it("mês que começa num domingo tem a primeira semana de um dia só", () => {
    expect(cashFlowBuckets({ view: "month", date: "2026-02-10" })).toEqual([
      { from: "2026-02-01", to: "2026-02-01" },
      { from: "2026-02-02", to: "2026-02-08" },
      { from: "2026-02-09", to: "2026-02-15" },
      { from: "2026-02-16", to: "2026-02-22" },
      { from: "2026-02-23", to: "2026-02-28" },
    ]);
  });

  it("ano: um intervalo por mês, respeitando anos bissextos", () => {
    const buckets = cashFlowBuckets({ view: "year", date: "2028-06-15" });

    expect(buckets).toHaveLength(12);
    expect(buckets[0]).toEqual({ from: "2028-01-01", to: "2028-01-31" });
    expect(buckets[1]).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(buckets[11]).toEqual({ from: "2028-12-01", to: "2028-12-31" });
  });
});

describe("cashFlowFetchRange", () => {
  const monthBuckets = cashFlowBuckets({ view: "month", date: "2026-09-24" });

  it("sem repasse, cobre só os intervalos exibidos", () => {
    expect(cashFlowFetchRange(monthBuckets, null)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("repasse semanal: estende até as semanas completas das pontas", () => {
    expect(cashFlowFetchRange(monthBuckets, "weekly")).toEqual({ from: "2026-08-31", to: "2026-10-04" });
  });

  it("repasse quinzenal: quinzenas são 1–15 e 16–fim do mês", () => {
    const buckets = [{ from: "2026-09-14", to: "2026-09-20" }];

    expect(cashFlowFetchRange(buckets, "biweekly")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("repasse mensal numa semana que atravessa meses: cobre os dois meses inteiros", () => {
    const buckets = cashFlowBuckets({ view: "week", date: "2026-10-01" });

    expect(cashFlowFetchRange(buckets, "monthly")).toEqual({ from: "2026-09-01", to: "2026-10-31" });
  });

  it("repasse mensal na visão anual não estende nada", () => {
    const buckets = cashFlowBuckets({ view: "year", date: "2026-09-24" });

    expect(cashFlowFetchRange(buckets, "monthly")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
});

// O dia em Brasília vai de 03:00 UTC até 03:00 UTC do dia seguinte.
const dayKey = (field: string) => ({ $dateToString: { format: "%Y-%m-%d", date: field, timezone: "-03:00" } });
const PROJECT = { $project: { _id: 0, date: "$_id", cents: 1 } };
const RANGE = { from: "2026-09-21", to: "2026-09-27" };

describe("dailyAppointmentTotalsPipeline", () => {
  it("filtra o intervalo em Brasília e soma os serviços por dia", () => {
    expect(dailyAppointmentTotalsPipeline(RANGE)).toEqual([
      {
        $match: {
          performedAt: { $gte: new Date("2026-09-21T03:00:00.000Z"), $lt: new Date("2026-09-28T03:00:00.000Z") },
        },
      },
      { $group: { _id: dayKey("$performedAt"), cents: { $sum: { $sum: "$items.priceCents" } } } },
      PROJECT,
    ]);
  });
});

describe("dailyBookingForecastPipeline", () => {
  const stagesAfterMatch = [
    {
      $lookup: {
        from: "services",
        localField: "service.serviceId",
        foreignField: "_id",
        as: "services",
        pipeline: [{ $project: { _id: 0, priceCents: 1 } }],
      },
    },
    // Agendamento sem serviço (ou com serviço excluído) conta como zero.
    {
      $group: {
        _id: dayKey("$startsAt"),
        cents: { $sum: { $ifNull: [{ $first: "$services.priceCents" }, 0] } },
      },
    },
    PROJECT,
  ];

  it("só conta agendamentos a partir de agora, com o preço atual do serviço", () => {
    expect(dailyBookingForecastPipeline(RANGE, NOW)).toEqual([
      { $match: { startsAt: { $gte: NOW, $lt: new Date("2026-09-28T03:00:00.000Z") } } },
      ...stagesAfterMatch,
    ]);
  });

  it("intervalo todo no futuro começa no início do intervalo", () => {
    const [match] = dailyBookingForecastPipeline(RANGE, new Date("2026-01-01T12:00:00.000Z"));

    expect(match).toEqual({
      $match: {
        startsAt: { $gte: new Date("2026-09-21T03:00:00.000Z"), $lt: new Date("2026-09-28T03:00:00.000Z") },
      },
    });
  });
});

const zero = { grossCents: 0, partnerShareCents: 0, netCents: 0 };

describe("summarizeCashFlow", () => {
  it("sem movimento, tudo zerado", () => {
    expect(summarizeCashFlow([day("2026-09-21")], [], [], null)).toEqual({
      buckets: [{ ...day("2026-09-21"), real: zero, forecast: zero }],
      total: { real: zero, forecast: zero },
    });
  });

  it("espaço próprio: real soma atendimentos, previsto soma atendimentos e agendamentos, sem repasse", () => {
    const result = summarizeCashFlow(
      [{ from: "2026-09-21", to: "2026-09-22" }, day("2026-09-23")],
      [
        { date: "2026-09-21", cents: 10_000 },
        { date: "2026-09-22", cents: 5_000 },
      ],
      [{ date: "2026-09-23", cents: 7_000 }],
      null,
    );

    expect(result).toEqual({
      buckets: [
        {
          from: "2026-09-21",
          to: "2026-09-22",
          real: { grossCents: 15_000, partnerShareCents: 0, netCents: 15_000 },
          forecast: { grossCents: 15_000, partnerShareCents: 0, netCents: 15_000 },
        },
        {
          ...day("2026-09-23"),
          real: zero,
          forecast: { grossCents: 7_000, partnerShareCents: 0, netCents: 7_000 },
        },
      ],
      total: {
        real: { grossCents: 15_000, partnerShareCents: 0, netCents: 15_000 },
        forecast: { grossCents: 22_000, partnerShareCents: 0, netCents: 22_000 },
      },
    });
  });

  it("dias buscados fora dos intervalos só entram no cálculo do repasse, não nos totais", () => {
    const share: RevenueShare = { period: "weekly", tiers: [{ upToCents: null, percent: 20 }] };

    const result = summarizeCashFlow(
      [day("2026-09-21"), day("2026-09-22")],
      [
        { date: "2026-09-20", cents: 99_000 },
        { date: "2026-09-21", cents: 10_000 },
        { date: "2026-09-22", cents: 30_000 },
      ],
      [],
      share,
    );

    expect(result.buckets.map((bucket) => bucket.real)).toEqual([
      { grossCents: 10_000, partnerShareCents: 2_000, netCents: 8_000 },
      { grossCents: 30_000, partnerShareCents: 6_000, netCents: 24_000 },
    ]);
    expect(result.total.real).toEqual({ grossCents: 40_000, partnerShareCents: 8_000, netCents: 32_000 });
  });

  it("repasse mensal por faixa numa semana: calcula sobre o mês e rateia pelo faturamento de cada dia", () => {
    // Até R$ 1.000 paga 10% sobre o total; acima disso, 20% sobre o total.
    const share: RevenueShare = {
      period: "monthly",
      tiers: [
        { upToCents: 100_000, percent: 10 },
        { upToCents: null, percent: 20 },
      ],
    };

    const result = summarizeCashFlow(
      [day("2026-09-21"), day("2026-09-22"), day("2026-09-25")],
      [
        { date: "2026-09-02", cents: 80_000 },
        { date: "2026-09-21", cents: 20_000 },
        { date: "2026-09-22", cents: 20_000 },
      ],
      [{ date: "2026-09-25", cents: 60_000 }],
      share,
    );

    // Real: mês = R$ 1.200 -> 20% = R$ 240, rateado 20.000/120.000 para cada dia.
    // Previsto: mês = R$ 1.800 -> 20% = R$ 360, rateado 20.000/180.000 e 60.000/180.000.
    expect(result.buckets).toEqual([
      {
        ...day("2026-09-21"),
        real: { grossCents: 20_000, partnerShareCents: 4_000, netCents: 16_000 },
        forecast: { grossCents: 20_000, partnerShareCents: 4_000, netCents: 16_000 },
      },
      {
        ...day("2026-09-22"),
        real: { grossCents: 20_000, partnerShareCents: 4_000, netCents: 16_000 },
        forecast: { grossCents: 20_000, partnerShareCents: 4_000, netCents: 16_000 },
      },
      {
        ...day("2026-09-25"),
        real: zero,
        forecast: { grossCents: 60_000, partnerShareCents: 12_000, netCents: 48_000 },
      },
    ]);
    expect(result.total).toEqual({
      real: { grossCents: 40_000, partnerShareCents: 8_000, netCents: 32_000 },
      forecast: { grossCents: 100_000, partnerShareCents: 20_000, netCents: 80_000 },
    });
  });

  it("intervalo que atravessa dois períodos de repasse soma a parte de cada um", () => {
    // Quinzenal: até R$ 500 paga 10% sobre o total; acima disso, 20% sobre o total.
    const share: RevenueShare = {
      period: "biweekly",
      tiers: [
        { upToCents: 50_000, percent: 10 },
        { upToCents: null, percent: 20 },
      ],
    };

    const result = summarizeCashFlow(
      [{ from: "2026-09-14", to: "2026-09-20" }],
      [
        { date: "2026-09-03", cents: 60_000 },
        { date: "2026-09-14", cents: 10_000 },
        { date: "2026-09-18", cents: 10_000 },
      ],
      [],
      share,
    );

    // 1ª quinzena: R$ 700 -> 20% = R$ 140, dia 14 fica com 10.000/70.000 = R$ 20.
    // 2ª quinzena: R$ 100 -> 10% = R$ 10, todo do dia 18.
    expect(result.buckets[0].real).toEqual({ grossCents: 20_000, partnerShareCents: 3_000, netCents: 17_000 });
  });
});

const PROJECT_SERVICE = { $project: { _id: 0, serviceId: { $toString: "$_id" }, serviceName: 1, count: 1, cents: 1 } };

describe("serviceAppointmentTotalsPipeline", () => {
  it("filtra o intervalo em Brasília e soma cada serviço, com o nome do registro mais recente", () => {
    expect(serviceAppointmentTotalsPipeline(RANGE)).toEqual([
      {
        $match: {
          performedAt: { $gte: new Date("2026-09-21T03:00:00.000Z"), $lt: new Date("2026-09-28T03:00:00.000Z") },
        },
      },
      { $sort: { performedAt: 1 } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.serviceId",
          serviceName: { $last: "$items.serviceName" },
          count: { $sum: 1 },
          cents: { $sum: "$items.priceCents" },
        },
      },
      PROJECT_SERVICE,
    ]);
  });
});

describe("serviceBookingForecastPipeline", () => {
  it("só conta agendamentos a partir de agora, com o nome e o preço atuais do serviço", () => {
    expect(serviceBookingForecastPipeline(RANGE, NOW)).toEqual([
      { $match: { startsAt: { $gte: NOW, $lt: new Date("2026-09-28T03:00:00.000Z") } } },
      {
        $lookup: {
          from: "services",
          localField: "service.serviceId",
          foreignField: "_id",
          as: "services",
          pipeline: [{ $project: { _id: 0, name: 1, priceCents: 1 } }],
        },
      },
      // Serviço excluído mantém o nome copiado no agendamento e conta como zero.
      {
        $group: {
          _id: "$service.serviceId",
          serviceName: { $last: { $ifNull: [{ $first: "$services.name" }, "$service.serviceName"] } },
          count: { $sum: 1 },
          cents: { $sum: { $ifNull: [{ $first: "$services.priceCents" }, 0] } },
        },
      },
      PROJECT_SERVICE,
    ]);
  });
});

describe("summarizeServices", () => {
  it("sem movimento, lista vazia", () => {
    expect(summarizeServices([], [])).toEqual([]);
  });

  it("real soma atendimentos; previsto soma atendimentos e agendamentos; ordena pelo previsto", () => {
    const result = summarizeServices(
      [
        { serviceId: "a", serviceName: "Relaxante", count: 2, cents: 20_000 },
        { serviceId: "b", serviceName: "Pedras quentes", count: 1, cents: 15_000 },
      ],
      [
        { serviceId: "b", serviceName: "Pedras quentes", count: 1, cents: 15_000 },
        { serviceId: "c", serviceName: "Reflexologia", count: 1, cents: 8_000 },
      ],
    );

    expect(result).toEqual([
      { serviceId: "b", serviceName: "Pedras quentes", real: { count: 1, cents: 15_000 }, forecast: { count: 2, cents: 30_000 } },
      { serviceId: "a", serviceName: "Relaxante", real: { count: 2, cents: 20_000 }, forecast: { count: 2, cents: 20_000 } },
      { serviceId: "c", serviceName: "Reflexologia", real: { count: 0, cents: 0 }, forecast: { count: 1, cents: 8_000 } },
    ]);
  });

  it("serviço renomeado usa o nome atual, vindo dos agendamentos", () => {
    const [row] = summarizeServices(
      [{ serviceId: "a", serviceName: "Massagem", count: 1, cents: 10_000 }],
      [{ serviceId: "a", serviceName: "Massagem relaxante", count: 1, cents: 10_000 }],
    );

    expect(row.serviceName).toBe("Massagem relaxante");
  });

  it("empate no previsto desempata pelo nome", () => {
    const result = summarizeServices(
      [
        { serviceId: "z", serviceName: "Shiatsu", count: 1, cents: 10_000 },
        { serviceId: "y", serviceName: "Drenagem", count: 1, cents: 10_000 },
      ],
      [],
    );

    expect(result.map((row) => row.serviceName)).toEqual(["Drenagem", "Shiatsu"]);
  });
});
