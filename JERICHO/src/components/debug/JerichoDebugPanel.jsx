import { useState, useEffect, useRef } from 'react';

const STATUS_COLOR = {
  ok: '#00ff88',
  fail: '#ff4444',
  warn: '#ffaa00',
};

const MODULE_SHORT = {
  generatePlan: 'GEN',
  compileAutoAsanaPlan: 'PROP',
  applyDraftSchedule: 'APPLY',
  commitBlocks: 'COMMIT',
  buildSuggestedBlocks: 'SUGGEST',
  applyCalibrationDays: 'CALIB',
  endCycle: 'CONV',
};

function useTraceCapture() {
  const [traces, setTraces] = useState([]);
  const originalGroup = useRef(null);
  const originalLog = useRef(null);
  const buffer = useRef(null);
  const pendingEntries = useRef([]);
  const flushScheduled = useRef(false);
  const mounted = useRef(false);
  const sequence = useRef(0);

  useEffect(() => {
    mounted.current = true;
    originalGroup.current = console.group;
    originalLog.current = console.log;

    const flushPendingEntries = () => {
      flushScheduled.current = false;
      if (!mounted.current || pendingEntries.current.length === 0) {
        return;
      }
      const entries = pendingEntries.current.splice(0, pendingEntries.current.length);
      setTraces((prev) => {
        let nextSequence = sequence.current;
        const captured = entries.map((entry) => {
          nextSequence += 1;
          return {
            ...entry.data,
            _capturedAt: Date.now(),
            _traceType: entry.type || null,
            _sequence: nextSequence,
          };
        });
        sequence.current = nextSequence;
        return [...captured, ...prev].slice(0, 50);
      });
    };

    const scheduleFlush = () => {
      if (flushScheduled.current) {
        return;
      }
      flushScheduled.current = true;
      const runFlush = () => {
        flushPendingEntries();
      };
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(runFlush);
        return;
      }
      Promise.resolve().then(runFlush);
    };

    console.group = (...args) => {
      const label = args[0];
      if (label === 'JERICHO_GENERATE_TRACE' || label === 'JERICHO_SUGGESTION_TRACE') {
        buffer.current = { type: label, timestamp: Date.now() };
      }
      originalGroup.current?.apply(console, args);
    };

    console.log = (...args) => {
      if (buffer.current && args[0] && typeof args[0] === 'object') {
        const activeBuffer = buffer.current;
        buffer.current = null;
        const data = args[0];
        pendingEntries.current.push({ data, type: activeBuffer?.type || null });
        scheduleFlush();
      }
      originalLog.current?.apply(console, args);
    };

    return () => {
      mounted.current = false;
      pendingEntries.current = [];
      flushScheduled.current = false;
      console.group = originalGroup.current;
      console.log = originalLog.current;
    };
  }, []);

  return traces;
}

function StatusDot({ status }) {
  const color = STATUS_COLOR[status] || '#888';
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}`,
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

function ModuleBadge({ name }) {
  const short = MODULE_SHORT[name] || name?.slice(0, 6).toUpperCase() || '???';
  return (
    <span
      style={{
        fontFamily: 'monospace',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1,
        padding: '1px 5px',
        borderRadius: 2,
        background: '#1a1a2e',
        border: '1px solid #333',
        color: '#aaa',
        marginRight: 6,
      }}
    >
      {short}
    </span>
  );
}

function TraceRow({ trace, isSelected, onClick }) {
  const status = trace.status || 'ok';
  const color = STATUS_COLOR[status] || '#888';
  const age = Math.round((Date.now() - trace._capturedAt) / 1000);
  const ageStr = age < 60 ? `${age}s ago` : `${Math.round(age / 60)}m ago`;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 8px',
        cursor: 'pointer',
        borderBottom: '1px solid #1a1a1a',
        background: isSelected ? '#0d1f0d' : 'transparent',
        borderLeft: isSelected ? `2px solid ${color}` : '2px solid transparent',
        gap: 4,
      }}
    >
      <StatusDot status={status} />
      <ModuleBadge name={trace.moduleName} />
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#666', marginRight: 'auto' }}>
        {trace.stepName || '—'}
      </span>
      {trace.errorCode && (
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ff4444', marginRight: 6 }}>
          {trace.errorCode}
        </span>
      )}
      <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#444' }}>{ageStr}</span>
    </div>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div
      style={{
        background: '#0a0a0a',
        border: '1px solid #1e1e1e',
        borderRadius: 4,
        padding: '8px 10px',
        minWidth: 90,
      }}
    >
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 18,
          fontWeight: 700,
          color: accent || '#e0e0e0',
          lineHeight: 1,
        }}
      >
        {value ?? '—'}
      </div>
    </div>
  );
}

function DetailPane({ trace }) {
  if (!trace) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#333',
          letterSpacing: 2,
        }}
      >
        SELECT A TRACE EVENT
      </div>
    );
  }

  const input = trace.inputSummary || {};
  const output = trace.outputSummary || {};
  const status = trace.status || 'ok';
  const color = STATUS_COLOR[status];

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <StatusDot status={status} />
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ccc', fontWeight: 700 }}>
          {trace.moduleName}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#555' }}>·</span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#666' }}>{trace.stepName}</span>
        {trace.errorCode && (
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'monospace',
              fontSize: 9,
              color: '#ff4444',
              background: '#1a0000',
              padding: '2px 6px',
              borderRadius: 2,
              border: '1px solid #330000',
            }}
          >
            {trace.errorCode}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <MetricCard label="CYCLE" value={trace.cycleId?.slice(-6) || '—'} />
        <MetricCard label="GOAL" value={trace.goalId?.slice(-6) || '—'} />
        <MetricCard label="STATUS" value={status.toUpperCase()} accent={color} />
      </div>

      {Object.keys(input).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 9,
              color: '#444',
              letterSpacing: 2,
              marginBottom: 6,
              paddingBottom: 4,
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            INPUT
          </div>
          {Object.entries(input).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#555', minWidth: 140 }}>{k}</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  color: v === null || v === undefined ? '#333' : '#bbb',
                }}
              >
                {v === null ? 'null' : v === undefined ? 'undefined' : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {Object.keys(output).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 9,
              color: '#444',
              letterSpacing: 2,
              marginBottom: 6,
              paddingBottom: 4,
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            OUTPUT
          </div>
          {Object.entries(output).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#555', minWidth: 140 }}>{k}</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  color:
                    typeof v === 'number' && v > 0
                      ? '#00ff88'
                      : v === null || v === undefined || v === 0
                        ? '#333'
                        : '#bbb',
                  fontWeight: typeof v === 'number' && v > 0 ? 700 : 400,
                }}
              >
                {Array.isArray(v)
                  ? `[${v.join(', ')}]`
                  : v === null
                    ? 'null'
                    : v === undefined
                      ? 'undefined'
                      : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {trace.reasonCodes?.length > 0 && (
        <div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 9,
              color: '#444',
              letterSpacing: 2,
              marginBottom: 6,
              paddingBottom: 4,
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            REASON CODES
          </div>
          {trace.reasonCodes.map((r) => (
            <div key={r} style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffaa00', marginBottom: 2 }}>
              · {r}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          paddingTop: 8,
          borderTop: '1px solid #1a1a1a',
          fontFamily: 'monospace',
          fontSize: 9,
          color: '#333',
        }}
      >
        {trace.timestamp || new Date(trace._capturedAt).toISOString()}
      </div>
    </div>
  );
}

function PipelineBar({ traces }) {
  const stages = ['PROP', 'GEN', 'APPLY', 'COMMIT'];
  const latest = {};
  traces.forEach((t) => {
    const short = MODULE_SHORT[t.moduleName];
    if (short && !latest[short]) latest[short] = t;
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '8px 14px',
        borderBottom: '1px solid #1a1a1a',
        background: '#050505',
      }}
    >
      {stages.map((stage, i) => {
        const trace = latest[stage];
        const status = trace?.status;
        const color = status ? STATUS_COLOR[status] : '#222';
        const isLast = i === stages.length - 1;
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1,
                padding: '3px 8px',
                borderRadius: 2,
                background: status ? '#0a0a0a' : '#0a0a0a',
                border: `1px solid ${color}`,
                color: color,
              }}
            >
              {stage}
            </div>
            {!isLast && (
              <div
                style={{
                  width: 20,
                  height: 1,
                  background: status ? color : '#1a1a1a',
                  margin: '0 2px',
                }}
              />
            )}
          </div>
        );
      })}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
        {['ok', 'fail', 'warn'].map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <StatusDot status={s} />
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#444' }}>
              {traces.filter((t) => t.status === s).length}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function JerichoDebugPanel() {
  const traces = useTraceCapture();
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [isOpen, setIsOpen] = useState(true);

  const latestGenerate = traces.find((t) => t.moduleName === 'generatePlan');
  const latestSuggest = traces.find((t) => t.moduleName === 'buildSuggestedBlocks' && t.stepName === 'complete');
  const latestCommit = traces.find((t) => t.moduleName === 'commitBlocks');
  const latestConv = traces.find((t) => t.moduleName === 'endCycle');

  const filtered =
    filter === 'ALL'
      ? traces
      : filter === 'FAIL'
        ? traces.filter((t) => t.status === 'fail')
        : traces.filter((t) => MODULE_SHORT[t.moduleName] === filter);

  const selectedTrace = selected !== null ? filtered[selected] : filtered[0] || null;

  if (!isOpen) {
    return (
      <div
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          background: '#0a0a0a',
          border: '1px solid #222',
          borderRadius: 4,
          padding: '6px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 9999,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: traces.some((t) => t.status === 'fail') ? '#ff4444' : '#00ff88',
            boxShadow: `0 0 6px ${traces.some((t) => t.status === 'fail') ? '#ff4444' : '#00ff88'}`,
          }}
        />
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#555', letterSpacing: 1 }}>JERICHO DEBUG</span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: 680,
        height: 420,
        background: '#080808',
        border: '1px solid #1e1e1e',
        borderBottom: 'none',
        borderRight: 'none',
        borderRadius: '8px 0 0 0',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        fontFamily: 'monospace',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.8)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '7px 12px',
          borderBottom: '1px solid #1a1a1a',
          background: '#050505',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: traces.some((t) => t.status === 'fail') ? '#ff4444' : '#00ff88',
            boxShadow: `0 0 8px ${traces.some((t) => t.status === 'fail') ? '#ff4444' : '#00ff88'}`,
          }}
        />
        <span style={{ fontSize: 10, color: '#666', letterSpacing: 2, fontWeight: 700 }}>JERICHO DEBUG</span>
        <span style={{ fontSize: 9, color: '#333', letterSpacing: 1 }}>PHASE 1</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {['ALL', 'FAIL', 'GEN', 'SUGGEST', 'COMMIT'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontFamily: 'monospace',
                fontSize: 9,
                letterSpacing: 1,
                padding: '2px 6px',
                borderRadius: 2,
                background: filter === f ? '#1a1a1a' : 'transparent',
                border: `1px solid ${filter === f ? '#333' : '#1a1a1a'}`,
                color: filter === f ? '#ccc' : '#444',
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => setIsOpen(false)}
            style={{
              fontFamily: 'monospace',
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 2,
              background: 'transparent',
              border: '1px solid #1a1a1a',
              color: '#444',
              cursor: 'pointer',
              marginLeft: 4,
            }}
          >
            ╱╲
          </button>
        </div>
      </div>

      {/* Pipeline bar */}
      <PipelineBar traces={traces} />

      {/* Metrics row */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 14px',
          borderBottom: '1px solid #1a1a1a',
          background: '#060606',
        }}
      >
        <MetricCard
          label="PROPOSED"
          value={latestGenerate?.outputSummary?.proposedBlocksCount ?? '—'}
          accent="#00ff88"
        />
        <MetricCard label="COMMITTED" value={latestCommit?.outputSummary?.createdBlockCount ?? '—'} accent="#00aaff" />
        <MetricCard
          label="SUGGESTIONS"
          value={latestSuggest?.outputSummary?.suggestionsCount ?? '—'}
          accent="#ffaa00"
        />
        <MetricCard label="HORIZON" value={latestGenerate?.inputSummary?.horizonDays ?? '—'} />
        <MetricCard
          label="VERDICT"
          value={latestConv?.outputSummary?.verdict ?? '—'}
          accent={
            latestConv?.outputSummary?.verdict === 'CONVERGED'
              ? '#00ff88'
              : latestConv?.outputSummary?.verdict === 'INCOMPLETE'
                ? '#ffaa00'
                : '#888'
          }
        />
        <MetricCard
          label="EVENTS"
          value={traces.length}
          accent={traces.some((t) => t.status === 'fail') ? '#ff4444' : '#555'}
        />
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Trace list */}
        <div
          style={{
            width: 240,
            borderRight: '1px solid #1a1a1a',
            overflow: 'auto',
            background: '#060606',
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: 16,
                fontFamily: 'monospace',
                fontSize: 10,
                color: '#333',
                textAlign: 'center',
                marginTop: 20,
                letterSpacing: 1,
              }}
            >
              NO TRACES YET
              <div style={{ marginTop: 8, fontSize: 9, color: '#222' }}>RUN A GOAL TO BEGIN</div>
            </div>
          ) : (
            filtered.map((trace, i) => (
              <TraceRow
                key={`${trace.traceId}-${trace._capturedAt}-${trace._sequence || i}`}
                trace={trace}
                isSelected={selected === i || (selected === null && i === 0)}
                onClick={() => setSelected(i)}
              />
            ))
          )}
        </div>

        {/* Detail pane */}
        <DetailPane trace={selectedTrace} />
      </div>
    </div>
  );
}
