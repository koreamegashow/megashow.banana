const CATEGORIES = ["식품", "생활&주방", "뷰티&패션", "라이프스타일"];
const STORAGE_OPTIONS = ["실온보관", "냉장보관", "냉동보관"];
const STORAGE_BLOCK_MAP = {
  "냉장보관": "냉장식품",
  "냉동보관": "냉동식품",
};
const FOOD_STORAGE_ISSUES_TO_HIDE = ["냉장식품", "냉동식품"];
const COMMON_ISSUE_OPTIONS = [
  { label: "국내생산제품", aliases: ["국내생산제품", "국내 생산 제품", "국내 생산된 제품이고"] },
  { label: "벤더사", aliases: ["벤더사"] },
  { label: "사입상품", aliases: ["사입상품"] },
  { label: "수출/해외배송 불가 제품", aliases: ["수출/해외배송 불가 제품"] },
  { label: "폐쇄몰 입점 제품", aliases: ["폐쇄몰 입점 제품"] },
];
const FOOD_ISSUE_OPTIONS = [
  { label: "건강기능식품", aliases: ["건강기능식품"] },
  { label: "주류제품", aliases: ["주류제품", "주류 제품", "주류품목", "주류 품목"] },
];
const COMMON_ISSUE_ALIAS_MAP = Object.fromEntries(
  COMMON_ISSUE_OPTIONS.map(({ label, aliases }) => [label, aliases])
);
const FOOD_ISSUE_ALIAS_MAP = Object.fromEntries(
  FOOD_ISSUE_OPTIONS.map(({ label, aliases }) => [label, aliases])
);

const data = Array.isArray(window.DISTRIBUTORS) ? window.DISTRIBUTORS : [];
const brochureLinks = window.BROCHURE_LINKS || {};
const state = {
  categories: new Set(),
  items: Object.fromEntries(CATEGORIES.map((cat) => [cat, new Set()])),
  storage: new Set(),
  commonIssues: new Set(),
  foodIssues: new Set(),
  types: new Set(),
  query: "",
  sort: "score",
};

const $ = (selector) => document.querySelector(selector);
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const byKo = (a, b) => String(a).localeCompare(String(b), "ko");
const intersects = (a = [], b = []) => a.some((x) => b.includes(x));

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeHref(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value) || /^(mailto:|tel:)/i.test(value)) return value;
  if (/^(\/|\.\/|\.\.\/)/.test(value)) return value;
  if (value.includes("/") || /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip)([#?].*)?$/i.test(value)) return value;
  return `https://${value}`;
}

function toBrochureEntries(value) {
  if (!value) return [];
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry, index) => {
    if (!entry) return [];
    if (typeof entry === "string") {
      return [{
        label: entries.length > 1 ? `소개서 ${index + 1} 열어보기` : "소개서 열어보기",
        url: entry,
      }];
    }
    if (entry.url) {
      return [{
        label: entry.label || (entries.length > 1 ? `소개서 ${index + 1} 열어보기` : "소개서 열어보기"),
        url: entry.url,
      }];
    }
    return [];
  });
}

function hasBrochure(company) {
  return toBrochureEntries(brochureLinks[company]).length > 0;
}

function allOptions(selector) {
  return uniq(data.flatMap(selector)).sort(byKo);
}

function renderCheck(container, options, filter, checkedSet, extra = {}) {
  const target = $(container);
  const inputType = extra.type || "checkbox";
  const nameAttr = extra.name ? `name="${escapeHTML(extra.name)}"` : "";
  const dataAttrs = Object.entries(extra)
    .filter(([key]) => !["type", "name"].includes(key))
    .map(([key, value]) => `data-${key}="${escapeHTML(value)}"`)
    .join(" ");
  target.innerHTML = options.map((option) => {
    const id = `${filter}-${option}`.replace(/[^a-zA-Z0-9가-힣]/g, "-");
    const checked = checkedSet.has(option) ? "checked" : "";
    return `<label class="check" for="${escapeHTML(id)}">
      <input id="${escapeHTML(id)}" type="${escapeHTML(inputType)}" ${nameAttr} data-filter="${escapeHTML(filter)}" value="${escapeHTML(option)}" ${dataAttrs} ${checked}>
      <span>${escapeHTML(option)}</span>
    </label>`;
  }).join("");
}

function renderCategoryOptions() {
  renderCheck("#categoryOptions", CATEGORIES, "category", state.categories, {
    type: "radio",
    name: "majorCategory",
  });
}

function renderItemOptions() {
  const wrap = $("#itemOptions");
  const selectedCategories = [...state.categories];
  if (selectedCategories.length === 0) {
    wrap.innerHTML = `<div class="notice">대분류를 먼저 선택하면 해당 상담 희망 품목이 표시됩니다.</div>`;
    return;
  }
  wrap.innerHTML = selectedCategories.map((cat) => {
    const options = allOptions((row) => row.items?.[cat] || []);
    const checks = options.map((option) => {
      const id = `item-${cat}-${option}`.replace(/[^a-zA-Z0-9가-힣]/g, "-");
      const checked = state.items[cat].has(option) ? "checked" : "";
      return `<label class="check" for="${escapeHTML(id)}">
        <input id="${escapeHTML(id)}" type="checkbox" data-filter="item" data-category="${escapeHTML(cat)}" value="${escapeHTML(option)}" ${checked}>
        <span>${escapeHTML(option)}</span>
      </label>`;
    }).join("");
    return `<div class="itemGroup">
      <p class="itemGroup__title">${escapeHTML(cat)} <span>${options.length}개</span></p>
      <div class="checkboxGrid">${checks}</div>
    </div>`;
  }).join("");
}

function renderSpecialOptions() {
  const common = COMMON_ISSUE_OPTIONS.map((option) => option.label);
  const foodPresetLabels = FOOD_ISSUE_OPTIONS.map((option) => option.label);
  const foodFromData = allOptions((row) => row.foodUnavailable || [])
    .filter((option) => !FOOD_STORAGE_ISSUES_TO_HIDE.includes(option))
    .filter((option) => !foodPresetLabels.some((label) => rowHasIssue([option], label, FOOD_ISSUE_ALIAS_MAP)));
  const food = [...foodPresetLabels, ...foodFromData];

  [...state.commonIssues].forEach((issue) => {
    if (!common.includes(issue)) state.commonIssues.delete(issue);
  });
  [...state.foodIssues].forEach((issue) => {
    if (!food.includes(issue)) state.foodIssues.delete(issue);
  });

  renderCheck("#foodIssueOptions", food, "foodIssue", state.foodIssues);
  renderCheck("#commonIssueOptions", common, "commonIssue", state.commonIssues);
  renderCheck("#storageOptions", STORAGE_OPTIONS, "storage", state.storage);

  const isFood = state.categories.has("식품");
  $("#storageBlock").classList.toggle("hidden", !isFood);
  $("#foodIssuePanel").classList.toggle("hidden", !isFood);
  if (!isFood) {
    state.storage.clear();
    state.foodIssues.clear();
  }
}

function renderExtraOptions() {
  renderCheck("#typeOptions", ["내수", "수출"], "type", state.types);
}

function rowMatchesCategory(row) {
  const selectedCategories = [...state.categories];
  if (selectedCategories.length === 0) return true;
  return selectedCategories.some((cat) => {
    const rowHasCat = (row.categories || []).includes(cat) || (row.items?.[cat] || []).length > 0;
    if (!rowHasCat) return false;
    const selectedItems = [...state.items[cat]];
    if (selectedItems.length === 0) return true;
    return intersects(row.items?.[cat] || [], selectedItems);
  });
}

function normalizeIssue(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function rowHasIssue(rowIssues, selectedIssue, aliasMap = {}) {
  const aliases = aliasMap[selectedIssue] || [selectedIssue];
  const normalizedRowIssues = rowIssues.map(normalizeIssue);
  return aliases.some((alias) => normalizedRowIssues.includes(normalizeIssue(alias)));
}

function publicCommonIssueLabels(rowIssues = []) {
  return COMMON_ISSUE_OPTIONS
    .filter(({ label }) => rowHasIssue(rowIssues, label, COMMON_ISSUE_ALIAS_MAP))
    .map(({ label }) => label);
}

function isMovedFoodIssue(issue) {
  return FOOD_ISSUE_OPTIONS.some(({ label }) => rowHasIssue([issue], label, FOOD_ISSUE_ALIAS_MAP));
}

function publicFoodIssueLabels(commonIssues = [], foodIssues = []) {
  const movedFoodLabels = FOOD_ISSUE_OPTIONS
    .filter(({ label }) => rowHasIssue(commonIssues, label, FOOD_ISSUE_ALIAS_MAP) || rowHasIssue(foodIssues, label, FOOD_ISSUE_ALIAS_MAP))
    .map(({ label }) => label);
  const rawFoodLabels = foodIssues.filter((issue) => !isMovedFoodIssue(issue));
  return uniq([...movedFoodLabels, ...rawFoodLabels]);
}

function rowMatchesRestrictions(row) {
  const common = row.commonUnavailable || [];
  const food = row.foodUnavailable || [];
  if ([...state.commonIssues].some((issue) => rowHasIssue(common, issue, COMMON_ISSUE_ALIAS_MAP))) return false;
  if ([...state.foodIssues].some((issue) => rowHasIssue(food, issue, FOOD_ISSUE_ALIAS_MAP) || rowHasIssue(common, issue, FOOD_ISSUE_ALIAS_MAP))) return false;
  for (const storage of state.storage) {
    const blockedTerm = STORAGE_BLOCK_MAP[storage];
    if (blockedTerm && food.includes(blockedTerm)) return false;
  }
  return true;
}

function rowMatchesType(row) {
  const selected = [...state.types];
  if (selected.length === 0) return true;
  return selected.some((type) => String(row.type || "").includes(type));
}

function rowMatchesQuery(row) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.company,
    row.type,
    row.schedule,
    ...(row.businessFields || []),
    ...(row.salesChannels || []),
    row.companyIntro,
    row.consultingPurpose,
    ...(row.categories || []),
    ...CATEGORIES.flatMap((cat) => row.items?.[cat] || []),
  ].join(" ").toLowerCase();
  return haystack.includes(q);
}

function scoreRow(row) {
  let score = 0;
  for (const cat of state.categories) {
    if ((row.categories || []).includes(cat)) score += 6;
    for (const item of state.items[cat]) {
      if ((row.items?.[cat] || []).includes(item)) score += 8;
    }
  }
  if (state.storage.size > 0 && row.categories?.includes("식품")) score += 2;
  if (row.type && rowMatchesType(row)) score += 1;
  if (hasBrochure(row.company)) score += 1;
  return score;
}

function groupRows(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.company)) {
      map.set(row.company, {
        company: row.company,
        rows: [],
        categories: new Set(),
        type: new Set(),
        schedule: new Set(),
        businessFields: new Set(),
        salesChannels: new Set(),
        commonUnavailable: new Set(),
        foodUnavailable: new Set(),
        purposes: new Set(),
        intros: [],
        items: Object.fromEntries(CATEGORIES.map((cat) => [cat, new Set()])),
        score: 0,
        homepage: "",
        brochureEntries: toBrochureEntries(brochureLinks[row.company]),
      });
    }
    const group = map.get(row.company);
    group.rows.push(row);
    group.score = Math.max(group.score, scoreRow(row));
    if (!group.homepage && row.homepage) group.homepage = row.homepage;
    (row.categories || []).forEach((x) => group.categories.add(x));
    if (row.type) group.type.add(row.type);
    if (row.schedule) group.schedule.add(row.schedule);
    (row.businessFields || []).forEach((x) => group.businessFields.add(x));
    (row.salesChannels || []).forEach((x) => group.salesChannels.add(x));
    (row.commonUnavailable || []).forEach((x) => group.commonUnavailable.add(x));
    (row.foodUnavailable || []).forEach((x) => group.foodUnavailable.add(x));
    if (row.consultingPurpose) group.purposes.add(row.consultingPurpose);
    if (row.companyIntro && !group.intros.includes(row.companyIntro)) group.intros.push(row.companyIntro);
    CATEGORIES.forEach((cat) => (row.items?.[cat] || []).forEach((x) => group.items[cat].add(x)));
  });
  return [...map.values()].map((group) => ({
    ...group,
    categories: [...group.categories].sort(byKo),
    type: [...group.type].sort(byKo),
    schedule: [...group.schedule].sort(byKo),
    businessFields: [...group.businessFields].sort(byKo),
    salesChannels: [...group.salesChannels].sort(byKo),
    commonUnavailable: [...group.commonUnavailable].sort(byKo),
    foodUnavailable: [...group.foodUnavailable].sort(byKo),
    purposes: [...group.purposes],
    items: Object.fromEntries(CATEGORIES.map((cat) => [cat, [...group.items[cat]].sort(byKo)])),
  }));
}

function sortGroups(groups) {
  if (state.sort === "company") return groups.sort((a, b) => byKo(a.company, b.company));
  return groups.sort((a, b) => b.score - a.score || byKo(a.company, b.company));
}

function selectedSummary() {
  const pieces = [];
  if (state.categories.size) pieces.push(`대분류 ${[...state.categories].join(", ")}`);
  const itemPieces = CATEGORIES.flatMap((cat) => [...state.items[cat]].map((item) => `${cat}:${item}`));
  if (itemPieces.length) pieces.push(`품목 ${itemPieces.join(", ")}`);
  if (state.storage.size) pieces.push(`보관 ${[...state.storage].join(", ")}`);
  if (state.commonIssues.size || state.foodIssues.size) pieces.push("특이사항 적용");
  if (state.types.size) pieces.push(`상담방향 ${[...state.types].join(", ")}`);
  if (state.query) pieces.push(`검색 "${state.query}"`);
  return pieces.length ? pieces.join(" · ") : "전체 유통사를 표시 중입니다.";
}

function chips(items, className = "chip") {
  if (!items || items.length === 0) return `<span class="chip">-</span>`;
  return items.map((x) => `<span class="${className}">${escapeHTML(x)}</span>`).join("");
}

function selectedFilterCount() {
  const itemCount = CATEGORIES.reduce((sum, cat) => sum + state.items[cat].size, 0);
  return state.categories.size
    + itemCount
    + state.storage.size
    + state.commonIssues.size
    + state.foodIssues.size
    + state.types.size
    + (state.query.trim() ? 1 : 0);
}

function updateCounter(selector, value) {
  const el = $(selector);
  if (el) el.textContent = value.toLocaleString("ko-KR");
}

function setMobileFilterOpen(isOpen) {
  const panel = $("#filterPanel");
  const button = $("#filterToggle");
  const label = $("#filterToggleText");
  if (!panel || !button) return;
  panel.classList.toggle("is-collapsed", !isOpen);
  button.setAttribute("aria-expanded", String(isOpen));
  if (label) label.textContent = isOpen ? "상품 조건 닫기 ▲" : "상품 조건 열기 ▼";
  updateFilterToggle();
}

function updateFilterToggle() {
  const button = $("#filterToggle");
  const panel = $("#filterPanel");
  const label = $("#filterToggleText");
  const badge = $("#activeFilterCount");
  if (!button || !panel) return;
  const collapsed = panel.classList.contains("is-collapsed");
  const count = selectedFilterCount();
  if (label) label.textContent = collapsed ? "상품 조건 열기 ▼" : "상품 조건 닫기 ▲";
  if (badge) badge.textContent = count > 0 ? `${count}개 조건 적용` : "조건 없음";
  button.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

function itemMatrix(group) {
  const cats = state.categories.size ? [...state.categories] : CATEGORIES;
  const blocks = cats
    .filter((cat) => group.items[cat]?.length)
    .map((cat) => `<div class="itemMatrix__row"><strong>${escapeHTML(cat)}</strong><div class="chips">${chips(group.items[cat])}</div></div>`)
    .join("");
  return blocks || `<p>상담 희망 품목 정보가 없습니다.</p>`;
}

function renderIntroText(intro, limit = 100) {
  const text = String(intro || "").trim();
  if (!text) return "";
  if (text.length <= limit) return `<p>${escapeHTML(text)}</p>`;
  const preview = text.slice(0, limit);
  return `<div class="introText" data-expanded="false">
    <p class="introPreview">${escapeHTML(preview)}...</p>
    <p class="introFull hidden">${escapeHTML(text)}</p>
    <button type="button" class="textButton" data-action="toggleIntro" aria-expanded="false">더보기 ▼</button>
  </div>`;
}

function buildReasons(group) {
  const reasons = [];
  if (state.categories.size) {
    const matchedCats = [...state.categories].filter((cat) => group.categories.includes(cat));
    if (matchedCats.length) reasons.push(`${matchedCats.join(", ")} 상담 가능`);
  }
  const matchedItems = CATEGORIES.flatMap((cat) => [...state.items[cat]].filter((item) => group.items[cat]?.includes(item)));
  if (matchedItems.length) reasons.push(`${matchedItems.slice(0, 3).join(", ")} 품목 일치${matchedItems.length > 3 ? " 외" : ""}`);
  if (state.storage.size) reasons.push(`${[...state.storage].join(", ")} 불가 조건 없음`);
  if (state.commonIssues.size || state.foodIssues.size) reasons.push("선택 특이사항 충돌 없음");
  if (reasons.length === 0) reasons.push("조건 선택 전 전체 보기");
  return reasons.map((reason) => `<span class="reason">${escapeHTML(reason)}</span>`).join("");
}

function renderCard(group) {
  const homepage = normalizeHref(group.homepage);
  const brochureEntries = toBrochureEntries(group.brochureEntries)
    .map((entry) => ({ ...entry, url: normalizeHref(entry.url) }))
    .filter((entry) => entry.url);
  const brochureButtons = brochureEntries.length
    ? brochureEntries.map((entry) => `<a class="actionBtn" href="${escapeHTML(entry.url)}" target="_blank" rel="noopener">${escapeHTML(entry.label)}</a>`).join("")
    : `<span class="actionBtn disabled">소개서 준비중</span>`;
  const unavailable = uniq([...publicCommonIssueLabels(group.commonUnavailable), ...publicFoodIssueLabels(group.commonUnavailable, group.foodUnavailable)]);
  const scheduleBadges = group.schedule.length ? chips(group.schedule, "badge warn") : "";
  const intro = group.intros[0] || "";
  const introText = renderIntroText(intro, 100);
  return `<article class="card">
    <div class="card__top">
      <div>
        <h3 class="companyName">${escapeHTML(group.company)}</h3>
        <p class="subtitle">${escapeHTML(group.salesChannels.slice(0, 5).join(" · ") || "주요판매채널 정보 없음")}</p>
      </div>
      <div class="actions">
        ${brochureButtons}
        ${homepage ? `<a class="actionBtn secondary" href="${escapeHTML(homepage)}" target="_blank" rel="noopener">공식채널</a>` : ""}
      </div>
    </div>

    <div class="badges">
      ${chips(group.type, "badge ok")}
      ${scheduleBadges}
      ${chips(group.categories, "badge category")}
      <span class="badge">매칭 데이터 ${group.rows.length}건</span>
    </div>

    <div class="reasons">${buildReasons(group)}</div>

    <div class="infoGrid">
      <div class="infoBox">
        <h4>상담 희망 품목</h4>
        <div class="itemMatrix">${itemMatrix(group)}</div>
      </div>
      <div class="infoBox">
        <h4>주요사업분야</h4>
        <div class="chips">${chips(group.businessFields)}</div>
      </div>
      <div class="infoBox">
        <h4>상담목적</h4>
        <p>${escapeHTML(group.purposes.join("\n---\n") || "-")}</p>
      </div>
      <div class="infoBox">
        <h4>주요판매채널</h4>
        <div class="chips">${chips(group.salesChannels)}</div>
      </div>
      ${introText ? `<div class="infoBox full"><h4>회사소개</h4>${introText}</div>` : ""}
    </div>

    ${unavailable.length ? `<div class="notice"><strong>상담 불가 조건</strong>${escapeHTML(unavailable.join(", "))}</div>` : ""}
  </article>`;
}

function render() {
  const matchedRows = data.filter((row) => rowMatchesCategory(row) && rowMatchesRestrictions(row) && rowMatchesType(row) && rowMatchesQuery(row));
  const groups = sortGroups(groupRows(matchedRows));
  updateCounter("#statMatched", groups.length);
  updateCounter("#mobileStatMatched", groups.length);
  updateFilterToggle();
  $("#conditionSummary").textContent = selectedSummary();
  $("#resultTitle").textContent = `상담 가능 유통사 ${groups.length.toLocaleString("ko-KR")}곳`;
  const results = $("#results");
  if (groups.length === 0) {
    results.innerHTML = $("#emptyTemplate").innerHTML;
  } else {
    results.innerHTML = groups.map(renderCard).join("");
  }
}

function reset() {
  state.categories.clear();
  CATEGORIES.forEach((cat) => state.items[cat].clear());
  state.storage.clear();
  state.commonIssues.clear();
  state.foodIssues.clear();
  state.types.clear();
  state.query = "";
  state.sort = "score";
  $("#keywordInput").value = "";
  $("#sortSelect").value = "score";
  renderCategoryOptions();
  renderItemOptions();
  renderSpecialOptions();
  renderExtraOptions();
  render();
}

function bindEvents() {
  document.body.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-filter]");
    if (!input) return;
    const value = input.value;
    const filter = input.dataset.filter;
    const checked = input.checked;
    if (filter === "category") {
      CATEGORIES.forEach((cat) => state.items[cat].clear());
      state.categories.clear();
      if (checked) state.categories.add(value);
      renderCategoryOptions();
      renderItemOptions();
      renderSpecialOptions();
    }
    if (filter === "item") {
      const cat = input.dataset.category;
      checked ? state.items[cat].add(value) : state.items[cat].delete(value);
    }
    if (filter === "storage") checked ? state.storage.add(value) : state.storage.delete(value);
    if (filter === "commonIssue") checked ? state.commonIssues.add(value) : state.commonIssues.delete(value);
    if (filter === "foodIssue") checked ? state.foodIssues.add(value) : state.foodIssues.delete(value);
    if (filter === "type") checked ? state.types.add(value) : state.types.delete(value);
    render();
  });

  document.body.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="toggleIntro"]');
    if (!button) return;
    const wrap = button.closest(".introText");
    if (!wrap) return;
    const expanded = wrap.dataset.expanded === "true";
    wrap.dataset.expanded = expanded ? "false" : "true";
    wrap.querySelector(".introPreview")?.classList.toggle("hidden", !expanded);
    wrap.querySelector(".introFull")?.classList.toggle("hidden", expanded);
    button.textContent = expanded ? "더보기 ▼" : "접기 ▲";
    button.setAttribute("aria-expanded", expanded ? "false" : "true");
  });

  $("#keywordInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });
  $("#sortSelect").addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });
  $("#resetBtn").addEventListener("click", reset);

  $("#filterToggle")?.addEventListener("click", () => {
    const panel = $("#filterPanel");
    setMobileFilterOpen(panel?.classList.contains("is-collapsed"));
  });

  $("#mobileApplyBtn")?.addEventListener("click", () => {
    setMobileFilterOpen(false);
    $(".resultsArea")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const mobileQuery = window.matchMedia("(max-width: 640px)");
  const syncFilterForViewport = () => setMobileFilterOpen(!mobileQuery.matches);
  syncFilterForViewport();
  if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", syncFilterForViewport);
  else if (mobileQuery.addListener) mobileQuery.addListener(syncFilterForViewport);
}

function setupBackToTop() {
  const button = $("#backToTopBtn");
  if (!button) return;

  const toggleButton = () => {
    button.classList.toggle("is-visible", window.scrollY > 420);
  };

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", toggleButton, { passive: true });
  toggleButton();
}

function init() {
  const companies = uniq(data.map((row) => row.company));
  updateCounter("#statCompanies", companies.length);
  updateCounter("#mobileStatCompanies", companies.length);
  renderCategoryOptions();
  renderItemOptions();
  renderSpecialOptions();
  renderExtraOptions();
  bindEvents();
  setupBackToTop();
  render();
}

document.addEventListener("DOMContentLoaded", init);
