import { useState } from 'react';

export default function PassingPercentControl({ value, onChange }) {
  const [custom, setCustom] = useState(value !== 50 && value !== 75 ? value : '');
  const isPreset = value === 50 || value === 75;

  return (
    <div className='pp-control'>
      <div className='pp-presets'>
        <button type='button' className={'btn ' + (value === 50 ? 'active' : '')} onClick={() => onChange(50)}>50%</button>
        <button type='button' className={'btn ' + (value === 75 ? 'active' : '')} onClick={() => onChange(75)}>75%</button>
      </div>
      <label>
        Custom
        <input
          type='number'
          min='1'
          max='100'
          value={isPreset ? '' : custom}
          placeholder='e.g. 60'
          onChange={(e) => {
            const v = e.target.value;
            setCustom(v);
            const num = Number(v);
            if (Number.isInteger(num) && num >= 1 && num <= 100) onChange(num);
          }}
        />
      </label>
    </div>
  );
}

