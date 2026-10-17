import React, { useState } from 'react';
import { removeTemplateMappings, useControls } from '../control/mappings';
import { applyTemplate, useMidi } from '../control/midi';
import { TEMPLATES, templatesFor, type ControllerTemplate } from '../control/templates';
import { field, option, sectionLabel } from './ui/theme';

// ---------------------------------------------------------------------------
// Controller templates in the MIDI panel: detected controllers get a one-click
// setup; any template can be applied to any input by hand.
// ---------------------------------------------------------------------------

const TemplateCard: React.FC<{
  template: ControllerTemplate;
  device: string;
  applied: boolean;
  onApply: () => void;
}> = ({ template, device, applied, onApply }) => (
  <div className="rounded bg-white/5 p-2 space-y-1">
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{template.name}</p>
        <p className="text-[10px] text-gray-500 truncate">{device}</p>
      </div>
      {applied ? (
        <button className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px]" onClick={() => removeTemplateMappings(template.id)}>
          Remove
        </button>
      ) : (
        <button className="px-2 py-0.5 rounded bg-cyan-500 text-black font-semibold hover:bg-cyan-400 text-[11px]" onClick={onApply}>
          Set up
        </button>
      )}
    </div>
    <p className="text-[10px] text-gray-400">{template.note}</p>
  </div>
);

export const TemplateSection: React.FC = () => {
  const on = useMidi(s => s.status === 'on');
  const inputs = useMidi(s => s.inputs);
  const mappings = useControls(s => s.mappings);
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState<{ template: string; device: string }>({ template: TEMPLATES[0].id, device: '' });
  if (!on) return null;

  const isApplied = (template: ControllerTemplate, device: string) =>
    mappings.some(m => m.template === template.id && m.source.kind !== 'key' && m.source.device === device);
  const apply = async (template: ControllerTemplate, device: string) => {
    const error = await applyTemplate(template, device);
    setMessage(error ?? `${template.name} is set up.`);
  };
  const detected = inputs.filter(i => i.connected).flatMap(i => templatesFor(i.name).map(template => ({ template, device: i.name })));
  const manualTemplate = TEMPLATES.find(t => t.id === manual.template) ?? TEMPLATES[0];

  return (
    <section className="space-y-2">
      <p className={sectionLabel}>Controller templates</p>
      {detected.map(({ template, device }) => (
        <TemplateCard
          key={`${template.id}|${device}`}
          template={template}
          device={device}
          applied={isApplied(template, device)}
          onApply={() => void apply(template, device)}
        />
      ))}
      {detected.length === 0 && inputs.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500">No known controller detected. Apply a template to an input by hand:</p>
          <div className="flex gap-1">
            <select value={manual.template} onChange={(e) => setManual(m => ({ ...m, template: e.target.value }))} className={`flex-1 min-w-0 ${field} py-0.5`}>
              {TEMPLATES.map(t => <option key={t.id} value={t.id} className={option}>{t.name}</option>)}
            </select>
            <select value={manual.device} onChange={(e) => setManual(m => ({ ...m, device: e.target.value }))} className={`flex-1 min-w-0 ${field} py-0.5`}>
              <option value="" className={option}>Input…</option>
              {inputs.map(i => <option key={i.id} value={i.name} className={option}>{i.name}</option>)}
            </select>
          </div>
          {manual.device && (
            <TemplateCard
              template={manualTemplate}
              device={manual.device}
              applied={isApplied(manualTemplate, manual.device)}
              onApply={() => void apply(manualTemplate, manual.device)}
            />
          )}
        </div>
      )}
      {message && <p className="text-[11px] text-gray-300">{message}</p>}
      <p className="text-[10px] text-gray-500">
        Templates follow the manufacturers’ MIDI documentation; they haven’t been tried on the hardware yet. Learned mappings for the same buttons replace template ones.
      </p>
    </section>
  );
};
