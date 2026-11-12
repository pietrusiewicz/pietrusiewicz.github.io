window.__ModuleLoader__.load({
	id: "dsh-session-cost",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");

		/** Default rates in USD per one million tokens (DeepSeek cache-miss pricing). */
		const DEFAULT_RATES = {
			input: 0.28,
			cacheRead: 0.028,
			cacheWrite: 0.28,
			output: 0.42
		};
		const RATES_KEY = "dsh-session-cost:rates";
		const ATTRIBUTE = "data-dsh-cost";
		const STYLE_ID = "dsh-session-cost/style";

		/** Read optional rate overrides so pricing can be changed without rebuilding. */
		function readRates() {
			try {
				const raw = localStorage.getItem(RATES_KEY);
				if (raw === null) return DEFAULT_RATES;
				const parsed = JSON.parse(raw);
				const rates = { ...DEFAULT_RATES };
				for (const key of Object.keys(DEFAULT_RATES)) {
					if (typeof parsed[key] === "number" && Number.isFinite(parsed[key]) && parsed[key] >= 0) rates[key] = parsed[key];
				}
				return rates;
			} catch {
				return DEFAULT_RATES;
			}
		}

		/** Estimated cost for one cumulative token-usage projection. */
		function costOf(usage, rates) {
			if (usage === null || typeof usage !== "object") return undefined;
			const value =
				(usage.uncachedInputTokens ?? 0) * rates.input +
				(usage.cacheReadTokens ?? 0) * rates.cacheRead +
				(usage.cacheWriteTokens ?? 0) * rates.cacheWrite +
				(usage.outputTokens ?? 0) * rates.output;
			return value / 1e6;
		}

		/** Compact USD label that keeps small totals readable. */
		function formatCost(cost) {
			if (!Number.isFinite(cost) || cost <= 0) return undefined;
			if (cost < 0.00005) return "<$0.0001";
			const digits = cost < 0.01 ? 4 : cost < 1 ? 3 : 2;
			return `$${cost.toFixed(digits)}`;
		}

		/** Inject the rule that renders the badge as the time cell's leading content. */
		function ensureStyle() {
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.dataset.plugin = "dsh-session-cost";
			style.textContent = [
				`[data-row-key^="session:"] span[${ATTRIBUTE}]::before {`,
				`  content: attr(${ATTRIBUTE});`,
				"  margin-right: 6px;",
				"  color: var(--dsw-alias-label-tertiary);",
				"  font-variant-numeric: tabular-nums;",
				"}"
			].join("\n");
			document.head.appendChild(style);
		}

		/** Resolve the row's trailing relative-time cell, skipping blank rows and the action strip. */
		function timeCell(row) {
			if (row.children.length < 4) return undefined;
			const cell = row.children[2];
			if (!(cell instanceof HTMLElement)) return undefined;
			if (cell.querySelector("button") !== null) return undefined;
			return cell;
		}

		/** Project one session's token usage from the list snapshot. */
		function usageOf(list, sessionId) {
			const projection = list.projectionsBySession?.[sessionId]?.values?.tokenUsage;
			if (projection !== undefined) return projection;
			return list.byId?.[sessionId]?.projectionValues?.tokenUsage;
		}

		/**
		 * Invisible frame-wide probe that decorates sidebar session rows with the
		 * estimated cost of their Session.
		 */
		function SessionCostProbe({ useSessions }) {
			const list = useSessions((state) => state);
			const listRef = react.useRef(list);
			listRef.current = list;
			const frameRef = react.useRef(0);

			const apply = react.useCallback(() => {
				ensureStyle();
				const current = listRef.current;
				const rates = readRates();
				for (const row of document.querySelectorAll('[data-row-key^="session:"]')) {
					const key = row.getAttribute("data-row-key") ?? "";
					const sessionId = key.slice("session:".length);
					if (sessionId === "") continue;
					const cell = timeCell(row);
					if (cell === undefined) continue;
					const label = formatCost(costOf(usageOf(current, sessionId), rates));
					if (label === undefined) {
						if (cell.hasAttribute(ATTRIBUTE)) cell.removeAttribute(ATTRIBUTE);
						continue;
					}
					if (cell.getAttribute(ATTRIBUTE) !== label) cell.setAttribute(ATTRIBUTE, label);
				}
			}, []);

			const schedule = react.useCallback(() => {
				if (frameRef.current !== 0) return;
				frameRef.current = requestAnimationFrame(() => {
					frameRef.current = 0;
					apply();
				});
			}, [apply]);

			react.useEffect(() => {
				schedule();
			}, [list, schedule]);

			react.useEffect(() => {
				const observer = new MutationObserver(schedule);
				observer.observe(document.body, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ["aria-selected", "data-row-key"]
				});
				return () => {
					observer.disconnect();
					if (frameRef.current !== 0) {
						cancelAnimationFrame(frameRef.current);
						frameRef.current = 0;
					}
				};
			}, [schedule]);

			return null;
		}

		const inject = ["slots"];

		/** Register the frame-wide probe once the layout declares the overlay seat. */
		function apply(ctx) {
			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register({ name: "shell.overlay", id: "session-cost.probe" }, SessionCostProbe)
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
