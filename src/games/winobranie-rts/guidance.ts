import type { Plan, Tool, VineyardState } from './model';

export interface Guidance {
  id: string;
  text: string;
  tone: 'info' | 'warning' | 'success';
  target?: string;
}

const total = (stock: Record<string, number>) =>
  Object.values(stock).reduce((a, n) => a + n, 0);

const placementHelp: Record<string, string> = {
  'Brak dojazdu':
    'Połącz drogę z miejscem rozładunku przy domku. Traktor potrzebuje szerokiego przejazdu.',
  'Brak dojścia':
    'Zostaw wolne przejście obok rzędu, aby pracownik mógł do niego dotrzeć.',
  'Cudza parcela':
    'Buduj na swojej ziemi. Sąsiednią działkę kupisz narzędziem „Parcela”.',
  'Zajęte pole': 'To miejsce jest zajęte. Przesuń podgląd na wolny teren.',
  'Jednostka na placu':
    'Na placu stoi człowiek lub traktor. Poczekaj, aż odjedzie, albo wybierz inne miejsce.',
  'Brak środków':
    'Brakuje gotówki. Sprzedaj gotowy moszcz lub zmniejsz planowaną budowę.',
  'Brak uprawnień':
    'Oba domki są już postawione. Wybierz „Wybór”, aby wrócić do gospodarstwa.',
  'Domek zajęty':
    'Przenosić można tylko pusty, niepracujący domek. Najpierw zakończ produkcję i sprzedaż.',
  'Odcięta jednostka':
    'Ten plan odcina jednostkę. Zostaw jej przejście do magazynu.',
  'Odcięty rząd':
    'Ten plan odcina winorośl. Zostaw pracownikom przejście do rzędu.',
  'Droga istnieje':
    'Tutaj droga już istnieje. Poprowadź kolejny odcinek od jej końca.',
  'Stromy stok': 'Ten stok jest zbyt stromy. Wybierz łagodniejszy teren.',
  'Maks. 64 pola':
    'Ten odcinek jest za długi. Podziel go na krótsze fragmenty.',
};
const toolHelp: Partial<Record<Tool, string>> = {
  house:
    'Postaw domek przy drodze. Zielony podgląd potwierdza miejsce i dojazd; obrót zmienia stronę rozładunku.',
  road: 'Przeciągnij drogę od istniejącego dojazdu do miejsca rozładunku przy domku.',
  row: 'Wybierz odmianę i przeciągnij rząd na swojej ziemi. Nowe krzewy potrzebują czasu na wzrost.',
  move: 'Wybierz pusty domek, a potem nowe miejsce. Przenosiny kosztują 1000 monet i wymagają ponownej budowy.',
  remove:
    'Wskaż rząd lub drogę do usunięcia. Odzyskasz tylko część kosztu sadzonek.',
  parcel: 'Wskaż sąsiednią działkę. Zakup ziemi kosztuje 6000 monet.',
  box: 'Przeciągnij ramkę wokół ludzi, a potem wybierz im rolę w panelu gospodarstwa.',
};

/** Read-only projection of the current game; no tutorial progress in the save. */
export function guidance(
  s: VineyardState,
  goal: number,
  tool: Tool = 'select',
  plan?: Plan,
  feedback = '',
): Guidance | null {
  if (s.completed || s.failed) return null;
  const say = (
    id: string,
    text: string,
    tone: Guidance['tone'] = 'info',
    target?: string,
  ): Guidance => ({ id, text, tone, ...(target ? { target } : {}) });
  const reason = feedback || (plan && !plan.valid ? plan.reason : '');
  if (reason)
    return say(
      `placement:${reason}`,
      placementHelp[reason] ?? reason,
      'warning',
    );
  if (toolHelp[tool]) return say(`tool:${tool}`, toolHelp[tool]!);
  if (s.sold >= goal && !s.ledger.arrears)
    return say(
      'goal',
      'Cel sprzedaży osiągnięty! Utrzymaj gospodarstwo bez zaległości do końca sezonu.',
      'success',
    );

  const ready = s.buildings.find((b) => total(b.must) > 0);
  if (ready)
    return say(
      'sale',
      s.ledger.arrears
        ? 'Masz zaległości. Otwórz gotowy domek i wybierz „Sprzedaj moszcz”, aby je spłacić.'
        : 'Moszcz jest gotowy! Otwórz domek i wybierz „Sprzedaj moszcz”.',
      'success',
      ready.id,
    );
  const blocked = s.units.find((u) => u.blocked && u.job);
  if (blocked)
    return say(
      'blocked',
      blocked.kind === 'tractor'
        ? 'Traktor nie ma dojazdu. Udrożnij drogę do rozładunku lub wybierz mu inne zadanie.'
        : 'Pracownik nie ma przejścia. Udrożnij trasę lub wybierz mu „Auto”, aby zmienił zadanie.',
      'warning',
      blocked.id,
    );
  if (!s.buildings.length)
    return say(
      'first-house',
      'Zbuduj domek przy drodze narzędziem „Domek”. W nim wytłoczysz moszcz z zebranych gron.',
    );

  const workers = s.units.filter((u) => u.kind === 'worker');
  const canWork = (role: 'build' | 'press' | 'harvest') =>
    workers.some((u) => u.role === 'auto' || u.role === role);
  const availableWorker = workers.find((u) => u.role === 'rest') ?? workers[0];
  const needsWork = [...s.buildings, ...s.rows].some((b) => b.work > 0);
  if (needsWork && !canWork('build'))
    return say(
      'builder',
      'Budowa czeka na człowieka. Wybierz pracownika i ustaw „Auto” lub „Budowa”.',
      'warning',
      availableWorker?.id,
    );
  if (s.buildings.every((b) => b.work > 0))
    return say(
      'building',
      'Pracownicy budują domek. Gdy skończą, traktor będzie mógł dostarczać grona.',
      'info',
      s.buildings[0].id,
    );
  const press = s.buildings.find(
    (b) => !b.work && (b.batch ? b.batch.work > 0 : total(b.stock) >= 1000),
  );
  if (press && !canWork('press'))
    return say(
      'operator',
      'Grona czekają przy prasie. Wybierz pracownika i ustaw „Auto” lub „Prasa”.',
      'warning',
      availableWorker?.id,
    );
  const tractor = s.units.find((u) => u.kind === 'tractor');
  if (total(s.warehouse) && tractor?.role === 'rest' && !total(tractor.cargo))
    return say(
      'driver',
      'Grona czekają w magazynie. Wybierz traktor i ustaw „Auto”, aby ruszył z dostawą.',
      'warning',
      tractor.id,
    );
  if (s.rows.some((r) => !r.work && r.stock > 0) && !canWork('harvest'))
    return say(
      'harvester',
      'Dojrzałe grona czekają. Wybierz pracownika i ustaw „Auto” lub „Zbiór”.',
      'warning',
      availableWorker?.id,
    );
  if (s.ledger.arrears)
    return say(
      'arrears',
      'Gospodarstwo ma zaległości. Dokończ produkcję i sprzedaj moszcz, aby je spłacić.',
      'warning',
    );
  if (s.buildings.some((b) => b.batch) || press)
    return say(
      'pressing',
      'Trwa tłoczenie moszczu. Gotową partię sprzedasz w panelu domku.',
    );
  if (total(s.warehouse) || s.units.some((u) => total(u.cargo)))
    return say(
      'transport',
      'Zebrane grona trafiają do domków przez magazyn. Ludzie i traktor w trybie „Auto” zajmą się transportem.',
    );
  if (s.rows.some((r) => r.stock > 0))
    return say(
      'harvest',
      'Pracownicy w trybie „Auto” zbierają grona. Traktor zawiezie je do gotowego domku.',
    );
  if (s.rows.some((r) => !r.mature || r.work))
    return say(
      'growth',
      'Młode krzewy jeszcze rosną. Pierwszy, niewielki plon pojawi się po dwóch minutach od posadzenia.',
    );
  return say(
    'empty',
    'Zbiory są wyczerpane. Nowe nasadzenia potrzebują dwóch minut, aby dać pierwszy plon.',
  );
}
