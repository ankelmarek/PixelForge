import type { VineyardState } from './model';
import type { Guidance } from './guidance';
import { campaignRules, campaignSuccess } from './campaign';
export function campaignGuidance(s: VineyardState): Guidance | null {
  const c = s.campaign;
  if (!c) return null;
  const say = (
    id: string,
    text: string,
    target?: string,
    tone: Guidance['tone'] = 'info',
  ): Guidance => ({ id, text, tone, ...(target ? { target } : {}) });
  if (c.crisisSince !== null || s.ledger.arrears)
    return say(
      'liquidity',
      'Gospodarstwo potrzebuje gotówki. Sprzedaj butelki lub grona z magazynu; w „Rozwój i finanse” masz pożyczkę i bieżące koszty.',
      undefined,
      'warning',
    );
  const ready = c.book.lots.find((l) => l.resource === 'bottles');
  if (ready)
    return say(
      'wine-sale',
      'Butelki są gotowe. Otwórz wskazany domek i sprzedaj partię; kontrakt premiuje dostawę odpowiedniej jakości.',
      ready.owner.slice(8),
      'success',
    );
  if (campaignSuccess(s))
    return say(
      'campaign-goal',
      'Cele są spełnione. Utrzymaj winnicę do końca trzeciej jesieni.',
      undefined,
      'success',
    );
  if (
    s.units.filter((u) => u.kind === 'worker').length < 3 &&
    s.rows.some((r) => r.work)
  )
    return say(
      'hire',
      'Rozbudowa i zbiory potrzebują ludzi. Otwórz „Rozwój i finanse”, zatrudnij pracownika i zostaw mu Auto.',
    );
  if (
    c.year === 1 &&
    s.tick < 5000 &&
    s.rows.reduce((n, r) => n + r.vines, 0) < 160
  )
    return say(
      'plant-years',
      `Zasadź więcej rzędów już w pierwszym roku. Młode krzewy dadzą 10%, potem 55% i pełny plon; celem jest ${campaignRules.bottles} butelek z trzech roczników.`,
    );
  const bottler = s.buildings.find(
    (b) => c.cellars[b.id].process?.stage === 'bottle',
  );
  if (bottler)
    return say(
      'bottler',
      'Wino jest po fermentacji. Butelkowanie wymaga człowieka w Auto lub Prasa; dodatkowa ekipa przyspieszy pracę.',
      bottler.id,
    );
  if (
    !c.contracts.some((t) => t.year === c.year && t.status !== 'offered') &&
    s.tick % 12000 < 9000
  )
    return say(
      'contract',
      'W „Rozwój i finanse” wybierz kontrakt na ten rocznik. Dostawa do gospody premiuje ilość, kolekcja wymaga wyższej jakości.',
    );
  const ferment = s.buildings.find(
    (b) => c.cellars[b.id].process?.stage === 'ferment',
  );
  if (c.year === 3 && s.tick >= 32400)
    return say(
      'last-vintage',
      'Zbliża się finał. Dla kolejnych partii wybierz Młode (30 s), a gotowe butelki sprzedaj przed końcem. Płynne zapasy możesz sprzedać taniej.',
      ferment?.id,
    );
  if (ferment)
    return say(
      'ferment',
      'Wino fermentuje. Rezerwa daje +10 jakości kosztem dłuższego zajęcia zbiornika. Możesz rozbudować winiarnię lub kupić trzeci domek.',
      ferment.id,
    );
  if (s.rows.some((r) => r.stock > 0))
    return say(
      'campaign-harvest',
      'Trwają zbiory. Ludzie przewożą grona do magazynu, traktory do domków. Sprawdź obłożenie i rozdziel pracę między pole a prasę.',
    );
  if (
    s.units.some((u) => Object.values(u.cargo).some((n) => n > 0)) ||
    Object.values(s.warehouse).some((n) => n > 0)
  )
    return say(
      'campaign-transport',
      'Grona czekają na przetworzenie. Zapewnij traktorom dojazd i pracownika w winiarni; sprzedaż surowych gron daje szybką, mniejszą zapłatę.',
    );
  if (s.rows.every((r) => r.mature))
    return say(
      'next-year',
      c.year < 3
        ? 'Zbiory dobiegają końca. Sprzedaj gotowe partie i przygotuj inwestycje na nową wiosnę; zegar sam rozpocznie kolejny rok.'
        : 'Ostatnia jesień. Sprzedaj gotowe butelki przed końcem czasu; niewykończone partie nie zaliczają celu.',
    );
  return null;
}
