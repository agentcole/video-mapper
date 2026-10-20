import React, { useMemo } from 'react';
import { Cable, Trash2, X } from 'lucide-react';
import {
  clearMappings, removeMapping, setTakeover, sourceLabel, updateMapping, useControls, type Mapping,
} from '../control/mappings';
import { CC_ENCODINGS, type CcEncoding } from '../control/midiMessages';
import { startLearning } from '../control/engine';
import { parseTarget, targetLabel, isFader } from '../control/targets';
import { disableMidi, enableMidi, setClockInput, useMidi } from '../control/midi';
import { TemplateSection } from './ControllerTemplates';
import { dialogSurface, field, iconButton, option, panelTitle, sectionLabel, segment, segmented } from './ui/theme';

// ---------------------------------------------------------------------------
// MIDI & keys: turn MIDI on, see the controllers, learn mappings, apply a
// controller template, manage mappings, follow a MIDI clock.
// ---------------------------------------------------------------------------

const MidiSection: React.FC = () => {
  const status = useMidi(s => s.status);
  const error = useMidi(s => s.error);
  const inputs = useMidi(s => s.inputs);
  const outputs = useMidi(s => s.outputs);
  const activity = useMidi(s => s.activity);
  const on = status === 'on';
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <p className={`${sectionLabel} flex-1`}>MIDI</p>
        <span className={`w-2 h-2 rounded-full ${on ? 'bg-emerald-400' : status === 'denied' || status === 'error' ? 'bg-red-500' : 'bg-white/20'}`} />
        <span className="text-[10px] text-gray-400">
          {on ? `${inputs.filter(i => i.connected).length} in · ${outputs.filter(o => o.connected).length} out` : status === 'requesting' ? 'Asking…' : 'Off'}
        </span>
        <button
          onClick={() => (on ? disableMidi() : void enableMidi())}
          className={`px-2 py-1 rounded text-xs font-semibold ${on ? 'bg-cyan-500 text-black hover:bg-cyan-400' : 'bg-white/10 hover:bg-white/20'}`}
        >
          {on ? 'On' : 'Turn on'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
      {on && inputs.length === 0 && <p className="text-[11px] text-gray-500">No MIDI controller connected — plug one in.</p>}
      {on && inputs.length > 0 && (
        <ul className="space-y-0.5">
          {inputs.map(input => {
            const active = activity?.device === input.name;
            return (
              <li key={input.id} className={`flex items-center gap-2 text-[11px] ${input.connected ? 'text-gray-200' : 'text-gray-500'}`}>
                <span key={active ? activity.at : 0} className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400 midi-blink' : 'bg-white/20'}`} />
                <span className="flex-1 truncate">{input.name}</span>
                {active && <span className="text-[10px] text-gray-400 tabular-nums">{activity.label}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {status === 'off' && (
        <p className="text-[10px] text-gray-500">The browser asks once for MIDI access. Works in Chrome and Edge.</p>
      )}
    </section>
  );
};

const MappingRow: React.FC<{ mapping: Mapping }> = ({ mapping }) => {
  const target = parseTarget(mapping.target);
  const { source } = mapping;
  return (
    <li className="rounded bg-white/5 px-2 py-1 space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="flex-1 min-w-0 truncate text-[11px] text-white">{target ? targetLabel(target) : mapping.target}</span>
        <button className={iconButton} onClick={() => removeMapping(mapping.id)} title="Remove this mapping">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
        <span className="flex-1 min-w-0 truncate">{sourceLabel(source)}{mapping.template ? ' · template' : ''}</span>
        {source.kind === 'cc' && target && isFader(target) && (
          <select
            value={source.encoding ?? 'absolute'}
            onChange={(e) => updateMapping(mapping.id, { source: { ...source, encoding: e.target.value as CcEncoding } })}
            className={`${field} py-0 text-[10px]`}
            title="How the control reports a turn: a position, or steps (endless encoders)"
          >
            {CC_ENCODINGS.map(e => <option key={e.encoding} value={e.encoding} className={option}>{e.label}</option>)}
          </select>
        )}
      </div>
    </li>
  );
};

const MappingsSection: React.FC<{ onLearn: () => void }> = ({ onLearn }) => {
  const mappings = useControls(s => s.mappings);
  const takeover = useControls(s => s.takeover);
  const sorted = useMemo(() => [...mappings].sort((a, b) => a.target.localeCompare(b.target, undefined, { numeric: true })), [mappings]);
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <p className={`${sectionLabel} flex-1`}>Mappings{mappings.length > 0 ? ` · ${mappings.length}` : ''}</p>
        {mappings.length > 0 && (
          <button className="text-[10px] text-gray-400 hover:text-red-300" onClick={() => confirm('Remove all mappings?') && clearMappings()}>
            Remove all
          </button>
        )}
      </div>
      <button
        onClick={onLearn}
        className="w-full flex items-center justify-center gap-1.5 h-8 rounded bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400"
        title="Click a control in the editor, then move a knob, press a pad or a key (M)"
      >
        <Cable className="w-3.5 h-3.5" /> Learn (M)
      </button>
      <p className="text-[10px] text-gray-500">
        Clips, columns, cue, Go, layer opacity and clear, crossfader, master, blackout, tempo and the macros can be mapped to MIDI or keys. Effect parameters: modulate them with a macro (∿) and map the macro.
      </p>
      {sorted.length > 0 && <ul className="space-y-1 max-h-64 overflow-y-auto pr-1">{sorted.map(m => <MappingRow key={m.id} mapping={m} />)}</ul>}
      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        <span title="When a fader on the controller doesn't match the value in the editor">Fader takeover</span>
        <div className={`${segmented} flex-1`}>
          <button className={segment(takeover === 'jump')} onClick={() => setTakeover('jump')} title="The value jumps to the controller">Jump</button>
          <button className={segment(takeover === 'pickup')} onClick={() => setTakeover('pickup')} title="Nothing happens until the controller passes the value">Pickup</button>
        </div>
      </div>
    </section>
  );
};

const ClockSection: React.FC = () => {
  const inputs = useMidi(s => s.inputs);
  const clockInput = useMidi(s => s.clockInput);
  const sources = useMidi(s => s.clockSources);
  const clock = useMidi(s => s.clock);
  const on = useMidi(s => s.status === 'on');
  if (!on) return null;
  return (
    <section className="space-y-1.5">
      <p className={sectionLabel}>MIDI clock in</p>
      <select
        value={clockInput ?? ''}
        onChange={(e) => setClockInput(e.target.value || null)}
        className={`w-full ${field}`}
        title="Follow the tempo (and, after Start, the bar) of a MIDI clock — a DAW, a drum machine, a DJ mixer"
      >
        <option value="" className={option}>Off — the master clock runs on its own</option>
        {inputs.map(i => (
          <option key={i.id} value={i.name} className={option}>{i.name}{sources.includes(i.name) ? ' · sends clock' : ''}</option>
        ))}
      </select>
      {clockInput && (
        <p className="text-[11px] text-gray-400">
          {clock?.bpm ? (
            <><span className="text-amber-300 tabular-nums">{clock.bpm.toFixed(1)} BPM</span> · {clock.running ? 'playing — bars follow the song position' : 'stopped — tempo only'}</>
          ) : 'Waiting for clock…'}
        </p>
      )}
    </section>
  );
};

export const ControlsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className={`fixed left-4 z-[1200] w-72 ${dialogSurface} flex flex-col`}
    style={{ bottom: 'calc(var(--launcher-height, 0px) + 16px)', maxHeight: 'calc(100vh - var(--launcher-height, 0px) - 48px)' }}
  >
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0">
      <h3 className={`${panelTitle} flex-1`}>
        <Cable className="w-4 h-4" />
        MIDI & Keys
      </h3>
      <button onClick={onClose} className={iconButton} title="Close">
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="overflow-y-auto p-3 space-y-4">
      <MidiSection />
      <TemplateSection />
      <MappingsSection
        onLearn={() => {
          startLearning();
          onClose();
        }}
      />
      <ClockSection />
    </div>
  </div>
);

/** Launcher toolbar: MIDI at a glance; opens the panel. */
export const MidiChip: React.FC<{ open: boolean; onClick: () => void }> = ({ open, onClick }) => {
  const on = useMidi(s => s.status === 'on');
  const activity = useMidi(s => s.activity);
  const learning = useControls(s => s.learning);
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded ${learning ? 'bg-cyan-500 text-black font-semibold' : open ? 'bg-white/25' : 'bg-white/10 hover:bg-white/20'}`}
      title="MIDI controllers, keyboard mappings, MIDI clock"
    >
      <Cable className={`w-3.5 h-3.5 ${on && !learning ? 'text-emerald-300' : ''}`} />
      <span>MIDI</span>
      {on && <span key={activity?.at ?? 0} className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${activity ? 'midi-blink' : 'opacity-20'}`} />}
    </button>
  );
};
