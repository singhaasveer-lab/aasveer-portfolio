"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  SERVICES,
  clearanceMinutes,
  congestionLevel,
  estimatedWait,
  makeToken,
  queueOrder,
  type Congestion,
  type ServiceCode,
  type SimCounter,
  type SimToken,
} from "@/lib/explorer/queueSim";

const LEVELS: Congestion[] = ["Low", "Moderate", "High", "Severe"];
const MAX_WAITING = 16;

const startingTokens = () => [
  makeToken(101, "GEN", false),
  makeToken(102, "DOC", false),
  makeToken(103, "FEE", true),
  makeToken(104, "TEC", false),
];
const startingCounters = (): SimCounter[] =>
  [1, 2, 3].map((id) => ({ id, open: true, serving: null }));

/**
 * A browser-only simulation that runs SmartQueue AI's own rules (src/lib/explorer/queueSim.ts).
 * Tokens are illustrative, nothing is connected to a live queue, and it is labelled so on screen.
 */
export function QueueSimulator() {
  const [tokens, setTokens] = useState<SimToken[]>(startingTokens);
  const [counters, setCounters] = useState<SimCounter[]>(startingCounters);
  const [seq, setSeq] = useState(105);
  const [priority, setPriority] = useState(false);
  const [status, setStatus] = useState("Simulation ready.");

  const open = counters.filter((c) => c.open).length;
  const waiting = queueOrder(tokens);
  const level = congestionLevel(tokens.length, open);
  const priorityCount = tokens.filter((t) => t.priority).length;

  function join(service: ServiceCode) {
    if (tokens.length >= MAX_WAITING) {
      setStatus("The simulated queue is full. Call or reset some tokens.");
      return;
    }
    const token = makeToken(seq, service, priority);
    setTokens([...tokens, token]);
    setSeq(seq + 1);
    setStatus(`${token.number} joined the queue.`);
  }

  function callNext() {
    const next = waiting[0];
    const free = counters.find((c) => c.open && !c.serving);
    if (!next) return setStatus("No tokens are waiting.");
    if (!free) return setStatus("Every open counter is busy.");
    setTokens(tokens.filter((t) => t.number !== next.number));
    setCounters(counters.map((c) => (c.id === free.id ? { ...c, serving: next } : c)));
    setStatus(`${next.number} called to Counter ${free.id}.`);
  }

  function complete(id: number) {
    setCounters(counters.map((c) => (c.id === id ? { ...c, serving: null } : c)));
    setStatus(`Counter ${id} completed its token.`);
  }

  function toggle(id: number) {
    setCounters(counters.map((c) => (c.id === id ? { ...c, open: !c.open } : c)));
  }

  function reset() {
    setTokens(startingTokens());
    setCounters(startingCounters());
    setSeq(105);
    setPriority(false);
    setStatus("Simulation reset.");
  }

  return (
    <section className="queue-sim" aria-labelledby="queue-sim-heading" data-testid="queue-sim">
      <header className="queue-sim-head">
        <h3 id="queue-sim-heading" className="label text-accent">
          Queue simulation
        </h3>
        <p className="queue-sim-flag">
          Simulation: illustrative tokens, computed in your browser. No live customers or data.
        </p>
      </header>

      <div className="queue-sim-grid">
        <div className="min-w-0">
          <p className="label">Waiting, in dispatch order ({tokens.length})</p>
          <ol className="queue-tokens" data-testid="queue-tokens">
            <AnimatePresence initial={false} mode="popLayout">
              {waiting.map((token, i) => (
                <motion.li
                  layout
                  key={token.number}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  data-priority={token.priority || undefined}
                >
                  <span className="font-mono">{token.number}</span>
                  <span className="text-faint">~{estimatedWait(token, i, open)} min</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          <div className="mt-5">
            <p className="label">Add a token</p>
            <div className="queue-actions">
              {SERVICES.map((service) => (
                <button
                  key={service.code}
                  type="button"
                  className="queue-btn"
                  onClick={() => join(service.code)}
                >
                  + {service.code}
                  <span className="sr-only"> (add a {service.name} token)</span>
                </button>
              ))}
              <button
                type="button"
                className="queue-btn"
                aria-pressed={priority}
                onClick={() => setPriority(!priority)}
              >
                Priority
              </button>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="label">Service counters ({open} open)</p>
          <ul className="queue-counters">
            {counters.map((counter) => (
              <li key={counter.id} data-open={counter.open || undefined}>
                <span className="font-mono text-xs">Counter {counter.id}</span>
                <span className="queue-serving">
                  {counter.serving?.number ?? (counter.open ? "Available" : "Closed")}
                </span>
                {counter.serving ? (
                  <button type="button" className="queue-btn" onClick={() => complete(counter.id)}>
                    Complete
                  </button>
                ) : (
                  <button
                    type="button"
                    className="queue-btn"
                    aria-label={`${counter.open ? "Close" : "Open"} Counter ${counter.id}`}
                    disabled={counter.open && open === 1}
                    onClick={() => toggle(counter.id)}
                  >
                    {counter.open ? "Close" : "Open"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="queue-actions mt-4">
            <button
              type="button"
              className="queue-btn queue-btn-primary"
              data-testid="queue-call"
              onClick={callNext}
            >
              Call next token
            </button>
            <button type="button" className="queue-btn" onClick={reset}>
              Reset
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <p className="label">Congestion insight</p>
          <p className="queue-level" data-testid="queue-congestion" data-level={level}>
            {level}
          </p>
          <div className="queue-meter" aria-hidden="true">
            {LEVELS.map((name, i) => (
              <span key={name} data-on={i <= LEVELS.indexOf(level) || undefined} />
            ))}
          </div>
          <dl className="queue-stats">
            <div>
              <dt>Waiting per open counter</dt>
              <dd>{(tokens.length / Math.max(1, open)).toFixed(1)}</dd>
            </div>
            <div>
              <dt>Estimated clearance</dt>
              <dd>{clearanceMinutes(tokens, open)} min</dd>
            </div>
            <div>
              <dt>Priority tokens waiting</dt>
              <dd>{priorityCount}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="queue-status" role="status" data-testid="queue-status">
        {status}
      </p>
    </section>
  );
}
