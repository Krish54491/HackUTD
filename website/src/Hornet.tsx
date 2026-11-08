import hornetPng from '../../web-extension/public/tango/hornet.png';
import type { TierId } from './hive';

const ASPECT = 207 / 320;

export function Hornet({ tierId, size = 96, flutter = false, dead = false }: { tierId: TierId; size?: number; flutter?: boolean; dead?: boolean }) {
  return (
    <span className={`hornet hornet-${tierId}${flutter ? ' flutter' : ''}${dead ? ' dead' : ''}`} style={{ width: size, height: size * ASPECT }} aria-hidden="true">
      {(tierId === 'legendary' || tierId === 'mythic') && <span className="hornet-aura" />}
      <img src={hornetPng} alt="" draggable={false} />
      {tierId === 'epic' && <span className="hornet-sparks"><i /><i /><i /></span>}
      {tierId === 'rare' && <span className="hornet-visor" />}
      {(tierId === 'legendary' || tierId === 'mythic') && (
        <svg className="hornet-crown" viewBox="0 0 24 16"><path d="M1 15 L3 3 L8 9 L12 1 L16 9 L21 3 L23 15 Z" fill={tierId === 'mythic' ? '#ff1f3d' : '#fbbf24'} stroke={tierId === 'mythic' ? '#ffd0d6' : '#fff4c2'} strokeWidth="1" strokeLinejoin="round" /></svg>
      )}
      {tierId === 'mythic' && <span className="hornet-embers"><i /><i /><i /><i /><i /></span>}
      {dead && <svg className="hornet-x" viewBox="0 0 10 10"><path d="M2 2 L8 8 M8 2 L2 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>}
    </span>
  );
}
