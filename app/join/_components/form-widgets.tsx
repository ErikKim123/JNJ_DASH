'use client';

// JOIN / OJUDGE 공용 폼 위젯 — 참가자 등록(JoinForm)과 온라인 심사위원 등록(OnlineJudgeForm)이
// 함께 쓰는 재사용 조각: 국가 코드 데이터, 검색형 국가 선택, WhatsApp 입력, 이미지 압축, 소소한 UI.
// 색상은 페이지 <main> 의 테마 토큰(var(--jnj-*))을 상속한다.
import { useEffect, useRef, useState } from 'react';

export type Lang = 'ko' | 'en';

// WhatsApp 국가 코드 — 라틴/아시아/북미/유럽 위주 + 전 세계 알파벳순.
// 라벨은 "국기 +코드 국가명" 포맷. dial 은 + 제외 숫자.
export const COUNTRY_CODES: { code: string; dial: string; flag: string; name: string }[] = [
  { code: 'KR', dial: '82', flag: '🇰🇷', name: 'Korea' },
  { code: 'US', dial: '1', flag: '🇺🇸', name: 'United States' },
  { code: 'JP', dial: '81', flag: '🇯🇵', name: 'Japan' },
  { code: 'CN', dial: '86', flag: '🇨🇳', name: 'China' },
  { code: 'TW', dial: '886', flag: '🇹🇼', name: 'Taiwan' },
  { code: 'HK', dial: '852', flag: '🇭🇰', name: 'Hong Kong' },
  { code: 'SG', dial: '65', flag: '🇸🇬', name: 'Singapore' },
  { code: 'MY', dial: '60', flag: '🇲🇾', name: 'Malaysia' },
  { code: 'TH', dial: '66', flag: '🇹🇭', name: 'Thailand' },
  { code: 'VN', dial: '84', flag: '🇻🇳', name: 'Vietnam' },
  { code: 'PH', dial: '63', flag: '🇵🇭', name: 'Philippines' },
  { code: 'ID', dial: '62', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'IN', dial: '91', flag: '🇮🇳', name: 'India' },
  { code: 'AU', dial: '61', flag: '🇦🇺', name: 'Australia' },
  { code: 'NZ', dial: '64', flag: '🇳🇿', name: 'New Zealand' },
  { code: 'GB', dial: '44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'DE', dial: '49', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', dial: '33', flag: '🇫🇷', name: 'France' },
  { code: 'ES', dial: '34', flag: '🇪🇸', name: 'Spain' },
  { code: 'IT', dial: '39', flag: '🇮🇹', name: 'Italy' },
  { code: 'NL', dial: '31', flag: '🇳🇱', name: 'Netherlands' },
  { code: 'RU', dial: '7', flag: '🇷🇺', name: 'Russia' },
  { code: 'CA', dial: '1', flag: '🇨🇦', name: 'Canada' },
  { code: 'MX', dial: '52', flag: '🇲🇽', name: 'Mexico' },
  { code: 'BR', dial: '55', flag: '🇧🇷', name: 'Brazil' },
  { code: 'AR', dial: '54', flag: '🇦🇷', name: 'Argentina' },
  { code: 'CO', dial: '57', flag: '🇨🇴', name: 'Colombia' },
  { code: 'CL', dial: '56', flag: '🇨🇱', name: 'Chile' },
  { code: 'PE', dial: '51', flag: '🇵🇪', name: 'Peru' },
  { code: 'CU', dial: '53', flag: '🇨🇺', name: 'Cuba' },
  { code: 'DO', dial: '1', flag: '🇩🇴', name: 'Dominican Republic' },
  { code: 'PR', dial: '1', flag: '🇵🇷', name: 'Puerto Rico' },
  { code: 'VE', dial: '58', flag: '🇻🇪', name: 'Venezuela' },
  { code: 'AF', dial: '93', flag: '🇦🇫', name: 'Afghanistan' },
  { code: 'AL', dial: '355', flag: '🇦🇱', name: 'Albania' },
  { code: 'DZ', dial: '213', flag: '🇩🇿', name: 'Algeria' },
  { code: 'AD', dial: '376', flag: '🇦🇩', name: 'Andorra' },
  { code: 'AO', dial: '244', flag: '🇦🇴', name: 'Angola' },
  { code: 'AG', dial: '1', flag: '🇦🇬', name: 'Antigua and Barbuda' },
  { code: 'AM', dial: '374', flag: '🇦🇲', name: 'Armenia' },
  { code: 'AT', dial: '43', flag: '🇦🇹', name: 'Austria' },
  { code: 'AZ', dial: '994', flag: '🇦🇿', name: 'Azerbaijan' },
  { code: 'BS', dial: '1', flag: '🇧🇸', name: 'Bahamas' },
  { code: 'BH', dial: '973', flag: '🇧🇭', name: 'Bahrain' },
  { code: 'BD', dial: '880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: 'BB', dial: '1', flag: '🇧🇧', name: 'Barbados' },
  { code: 'BY', dial: '375', flag: '🇧🇾', name: 'Belarus' },
  { code: 'BE', dial: '32', flag: '🇧🇪', name: 'Belgium' },
  { code: 'BZ', dial: '501', flag: '🇧🇿', name: 'Belize' },
  { code: 'BJ', dial: '229', flag: '🇧🇯', name: 'Benin' },
  { code: 'BT', dial: '975', flag: '🇧🇹', name: 'Bhutan' },
  { code: 'BO', dial: '591', flag: '🇧🇴', name: 'Bolivia' },
  { code: 'BA', dial: '387', flag: '🇧🇦', name: 'Bosnia and Herzegovina' },
  { code: 'BW', dial: '267', flag: '🇧🇼', name: 'Botswana' },
  { code: 'BN', dial: '673', flag: '🇧🇳', name: 'Brunei' },
  { code: 'BG', dial: '359', flag: '🇧🇬', name: 'Bulgaria' },
  { code: 'BF', dial: '226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: 'BI', dial: '257', flag: '🇧🇮', name: 'Burundi' },
  { code: 'KH', dial: '855', flag: '🇰🇭', name: 'Cambodia' },
  { code: 'CM', dial: '237', flag: '🇨🇲', name: 'Cameroon' },
  { code: 'CV', dial: '238', flag: '🇨🇻', name: 'Cape Verde' },
  { code: 'CF', dial: '236', flag: '🇨🇫', name: 'Central African Republic' },
  { code: 'TD', dial: '235', flag: '🇹🇩', name: 'Chad' },
  { code: 'KM', dial: '269', flag: '🇰🇲', name: 'Comoros' },
  { code: 'CG', dial: '242', flag: '🇨🇬', name: 'Congo' },
  { code: 'CR', dial: '506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: 'CI', dial: '225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: 'HR', dial: '385', flag: '🇭🇷', name: 'Croatia' },
  { code: 'CY', dial: '357', flag: '🇨🇾', name: 'Cyprus' },
  { code: 'CZ', dial: '420', flag: '🇨🇿', name: 'Czechia' },
  { code: 'CD', dial: '243', flag: '🇨🇩', name: 'DR Congo' },
  { code: 'DK', dial: '45', flag: '🇩🇰', name: 'Denmark' },
  { code: 'DJ', dial: '253', flag: '🇩🇯', name: 'Djibouti' },
  { code: 'DM', dial: '1', flag: '🇩🇲', name: 'Dominica' },
  { code: 'EC', dial: '593', flag: '🇪🇨', name: 'Ecuador' },
  { code: 'EG', dial: '20', flag: '🇪🇬', name: 'Egypt' },
  { code: 'SV', dial: '503', flag: '🇸🇻', name: 'El Salvador' },
  { code: 'GQ', dial: '240', flag: '🇬🇶', name: 'Equatorial Guinea' },
  { code: 'ER', dial: '291', flag: '🇪🇷', name: 'Eritrea' },
  { code: 'EE', dial: '372', flag: '🇪🇪', name: 'Estonia' },
  { code: 'SZ', dial: '268', flag: '🇸🇿', name: 'Eswatini' },
  { code: 'ET', dial: '251', flag: '🇪🇹', name: 'Ethiopia' },
  { code: 'FJ', dial: '679', flag: '🇫🇯', name: 'Fiji' },
  { code: 'FI', dial: '358', flag: '🇫🇮', name: 'Finland' },
  { code: 'GA', dial: '241', flag: '🇬🇦', name: 'Gabon' },
  { code: 'GM', dial: '220', flag: '🇬🇲', name: 'Gambia' },
  { code: 'GE', dial: '995', flag: '🇬🇪', name: 'Georgia' },
  { code: 'GH', dial: '233', flag: '🇬🇭', name: 'Ghana' },
  { code: 'GR', dial: '30', flag: '🇬🇷', name: 'Greece' },
  { code: 'GD', dial: '1', flag: '🇬🇩', name: 'Grenada' },
  { code: 'GT', dial: '502', flag: '🇬🇹', name: 'Guatemala' },
  { code: 'GN', dial: '224', flag: '🇬🇳', name: 'Guinea' },
  { code: 'GW', dial: '245', flag: '🇬🇼', name: 'Guinea-Bissau' },
  { code: 'GY', dial: '592', flag: '🇬🇾', name: 'Guyana' },
  { code: 'HT', dial: '509', flag: '🇭🇹', name: 'Haiti' },
  { code: 'HN', dial: '504', flag: '🇭🇳', name: 'Honduras' },
  { code: 'HU', dial: '36', flag: '🇭🇺', name: 'Hungary' },
  { code: 'IS', dial: '354', flag: '🇮🇸', name: 'Iceland' },
  { code: 'IR', dial: '98', flag: '🇮🇷', name: 'Iran' },
  { code: 'IQ', dial: '964', flag: '🇮🇶', name: 'Iraq' },
  { code: 'IE', dial: '353', flag: '🇮🇪', name: 'Ireland' },
  { code: 'IL', dial: '972', flag: '🇮🇱', name: 'Israel' },
  { code: 'JM', dial: '1', flag: '🇯🇲', name: 'Jamaica' },
  { code: 'JO', dial: '962', flag: '🇯🇴', name: 'Jordan' },
  { code: 'KZ', dial: '7', flag: '🇰🇿', name: 'Kazakhstan' },
  { code: 'KE', dial: '254', flag: '🇰🇪', name: 'Kenya' },
  { code: 'KI', dial: '686', flag: '🇰🇮', name: 'Kiribati' },
  { code: 'XK', dial: '383', flag: '🇽🇰', name: 'Kosovo' },
  { code: 'KW', dial: '965', flag: '🇰🇼', name: 'Kuwait' },
  { code: 'KG', dial: '996', flag: '🇰🇬', name: 'Kyrgyzstan' },
  { code: 'LA', dial: '856', flag: '🇱🇦', name: 'Laos' },
  { code: 'LV', dial: '371', flag: '🇱🇻', name: 'Latvia' },
  { code: 'LB', dial: '961', flag: '🇱🇧', name: 'Lebanon' },
  { code: 'LS', dial: '266', flag: '🇱🇸', name: 'Lesotho' },
  { code: 'LR', dial: '231', flag: '🇱🇷', name: 'Liberia' },
  { code: 'LY', dial: '218', flag: '🇱🇾', name: 'Libya' },
  { code: 'LI', dial: '423', flag: '🇱🇮', name: 'Liechtenstein' },
  { code: 'LT', dial: '370', flag: '🇱🇹', name: 'Lithuania' },
  { code: 'LU', dial: '352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: 'MO', dial: '853', flag: '🇲🇴', name: 'Macau' },
  { code: 'MG', dial: '261', flag: '🇲🇬', name: 'Madagascar' },
  { code: 'MW', dial: '265', flag: '🇲🇼', name: 'Malawi' },
  { code: 'MV', dial: '960', flag: '🇲🇻', name: 'Maldives' },
  { code: 'ML', dial: '223', flag: '🇲🇱', name: 'Mali' },
  { code: 'MT', dial: '356', flag: '🇲🇹', name: 'Malta' },
  { code: 'MH', dial: '692', flag: '🇲🇭', name: 'Marshall Islands' },
  { code: 'MR', dial: '222', flag: '🇲🇷', name: 'Mauritania' },
  { code: 'MU', dial: '230', flag: '🇲🇺', name: 'Mauritius' },
  { code: 'FM', dial: '691', flag: '🇫🇲', name: 'Micronesia' },
  { code: 'MD', dial: '373', flag: '🇲🇩', name: 'Moldova' },
  { code: 'MC', dial: '377', flag: '🇲🇨', name: 'Monaco' },
  { code: 'MN', dial: '976', flag: '🇲🇳', name: 'Mongolia' },
  { code: 'ME', dial: '382', flag: '🇲🇪', name: 'Montenegro' },
  { code: 'MA', dial: '212', flag: '🇲🇦', name: 'Morocco' },
  { code: 'MZ', dial: '258', flag: '🇲🇿', name: 'Mozambique' },
  { code: 'MM', dial: '95', flag: '🇲🇲', name: 'Myanmar' },
  { code: 'NA', dial: '264', flag: '🇳🇦', name: 'Namibia' },
  { code: 'NR', dial: '674', flag: '🇳🇷', name: 'Nauru' },
  { code: 'NP', dial: '977', flag: '🇳🇵', name: 'Nepal' },
  { code: 'NI', dial: '505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: 'NE', dial: '227', flag: '🇳🇪', name: 'Niger' },
  { code: 'NG', dial: '234', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'KP', dial: '850', flag: '🇰🇵', name: 'North Korea' },
  { code: 'MK', dial: '389', flag: '🇲🇰', name: 'North Macedonia' },
  { code: 'NO', dial: '47', flag: '🇳🇴', name: 'Norway' },
  { code: 'OM', dial: '968', flag: '🇴🇲', name: 'Oman' },
  { code: 'PK', dial: '92', flag: '🇵🇰', name: 'Pakistan' },
  { code: 'PW', dial: '680', flag: '🇵🇼', name: 'Palau' },
  { code: 'PS', dial: '970', flag: '🇵🇸', name: 'Palestine' },
  { code: 'PA', dial: '507', flag: '🇵🇦', name: 'Panama' },
  { code: 'PG', dial: '675', flag: '🇵🇬', name: 'Papua New Guinea' },
  { code: 'PY', dial: '595', flag: '🇵🇾', name: 'Paraguay' },
  { code: 'PL', dial: '48', flag: '🇵🇱', name: 'Poland' },
  { code: 'PT', dial: '351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'QA', dial: '974', flag: '🇶🇦', name: 'Qatar' },
  { code: 'RO', dial: '40', flag: '🇷🇴', name: 'Romania' },
  { code: 'RW', dial: '250', flag: '🇷🇼', name: 'Rwanda' },
  { code: 'KN', dial: '1', flag: '🇰🇳', name: 'Saint Kitts and Nevis' },
  { code: 'LC', dial: '1', flag: '🇱🇨', name: 'Saint Lucia' },
  { code: 'VC', dial: '1', flag: '🇻🇨', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', dial: '685', flag: '🇼🇸', name: 'Samoa' },
  { code: 'SM', dial: '378', flag: '🇸🇲', name: 'San Marino' },
  { code: 'ST', dial: '239', flag: '🇸🇹', name: 'Sao Tome and Principe' },
  { code: 'SA', dial: '966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: 'SN', dial: '221', flag: '🇸🇳', name: 'Senegal' },
  { code: 'RS', dial: '381', flag: '🇷🇸', name: 'Serbia' },
  { code: 'SC', dial: '248', flag: '🇸🇨', name: 'Seychelles' },
  { code: 'SL', dial: '232', flag: '🇸🇱', name: 'Sierra Leone' },
  { code: 'SK', dial: '421', flag: '🇸🇰', name: 'Slovakia' },
  { code: 'SI', dial: '386', flag: '🇸🇮', name: 'Slovenia' },
  { code: 'SB', dial: '677', flag: '🇸🇧', name: 'Solomon Islands' },
  { code: 'SO', dial: '252', flag: '🇸🇴', name: 'Somalia' },
  { code: 'ZA', dial: '27', flag: '🇿🇦', name: 'South Africa' },
  { code: 'SS', dial: '211', flag: '🇸🇸', name: 'South Sudan' },
  { code: 'LK', dial: '94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: 'SD', dial: '249', flag: '🇸🇩', name: 'Sudan' },
  { code: 'SR', dial: '597', flag: '🇸🇷', name: 'Suriname' },
  { code: 'SE', dial: '46', flag: '🇸🇪', name: 'Sweden' },
  { code: 'CH', dial: '41', flag: '🇨🇭', name: 'Switzerland' },
  { code: 'SY', dial: '963', flag: '🇸🇾', name: 'Syria' },
  { code: 'TJ', dial: '992', flag: '🇹🇯', name: 'Tajikistan' },
  { code: 'TZ', dial: '255', flag: '🇹🇿', name: 'Tanzania' },
  { code: 'TL', dial: '670', flag: '🇹🇱', name: 'Timor-Leste' },
  { code: 'TG', dial: '228', flag: '🇹🇬', name: 'Togo' },
  { code: 'TO', dial: '676', flag: '🇹🇴', name: 'Tonga' },
  { code: 'TT', dial: '1', flag: '🇹🇹', name: 'Trinidad and Tobago' },
  { code: 'TN', dial: '216', flag: '🇹🇳', name: 'Tunisia' },
  { code: 'TR', dial: '90', flag: '🇹🇷', name: 'Turkey' },
  { code: 'TM', dial: '993', flag: '🇹🇲', name: 'Turkmenistan' },
  { code: 'TV', dial: '688', flag: '🇹🇻', name: 'Tuvalu' },
  { code: 'UG', dial: '256', flag: '🇺🇬', name: 'Uganda' },
  { code: 'UA', dial: '380', flag: '🇺🇦', name: 'Ukraine' },
  { code: 'AE', dial: '971', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: 'UY', dial: '598', flag: '🇺🇾', name: 'Uruguay' },
  { code: 'UZ', dial: '998', flag: '🇺🇿', name: 'Uzbekistan' },
  { code: 'VU', dial: '678', flag: '🇻🇺', name: 'Vanuatu' },
  { code: 'YE', dial: '967', flag: '🇾🇪', name: 'Yemen' },
  { code: 'ZM', dial: '260', flag: '🇿🇲', name: 'Zambia' },
  { code: 'ZW', dial: '263', flag: '🇿🇼', name: 'Zimbabwe' },
];

// 검색 가능한 국가 선택 — 국가가 많아 네이티브 select 대신 타이핑 필터 콤보박스.
// 값은 국가명(name)을 저장.
export function CountrySelect({
  value,
  onChange,
  placeholder,
  options = COUNTRY_CODES,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options?: { code: string; flag: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const selected = options.find((o) => o.name === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().startsWith(q))
    : options;

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="jnj-input"
        value={open ? query : selected ? `${selected.flag} ${selected.name}` : ''}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setActive(0); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) pick(filtered[active].name); }
          else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
        }}
        autoComplete="off"
      />
      {open && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 30,
            marginTop: 4,
            maxHeight: 280,
            overflowY: 'auto',
            listStyle: 'none',
            margin: '4px 0 0',
            padding: 4,
            background: 'var(--jnj-surface)',
            border: '1px solid var(--jnj-border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: '10px 12px', color: 'var(--jnj-text-muted)', fontSize: 14 }}>—</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.code}
                onMouseDown={(e) => { e.preventDefault(); pick(o.name); }}
                onMouseEnter={() => setActive(i)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 15,
                  color: 'var(--jnj-text)',
                  background: i === active ? 'var(--jnj-track)' : 'transparent',
                }}
              >
                {o.flag} {o.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// WhatsApp 스타일 전화번호 입력 — 좌측 국가 코드 셀렉터 + 우측 번호 입력.
// 저장 포맷: "+{dial} {number}" (예: "+82 10-1234-5678").
export function WhatsAppInput({
  value,
  onChange,
  placeholder,
  defaultDial,
  selectLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  defaultDial: string;
  selectLabel?: string;
}) {
  const parsed = parseWhatsApp(value, defaultDial);
  const dial = parsed.dial;
  const number = parsed.number;

  const update = (nextDial: string, nextNumber: string) => {
    const trimmed = nextNumber.trim();
    if (!nextDial) {
      onChange(trimmed);
      return;
    }
    onChange(trimmed ? `+${nextDial} ${trimmed}` : `+${nextDial}`);
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        gap: 0,
        alignItems: 'stretch',
        border: '1px solid var(--jnj-border)',
        borderRadius: 8,
        background: 'var(--jnj-surface)',
      }}
    >
      <DialCodeSelect dial={dial} onPick={(d) => update(d, number)} options={COUNTRY_CODES} selectLabel={selectLabel} />
      <input
        type="tel"
        inputMode="tel"
        value={number}
        onChange={(e) => update(dial, e.target.value)}
        placeholder={placeholder}
        maxLength={32}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          padding: '12px 14px',
          fontSize: 16,
          background: 'transparent',
          color: 'var(--jnj-text)',
          minWidth: 0,
          borderTopRightRadius: 8,
          borderBottomRightRadius: 8,
        }}
      />
    </div>
  );
}

// 검색 가능한 국가 전화코드 선택.
function DialCodeSelect({
  dial,
  onPick,
  options,
  selectLabel,
}: {
  dial: string;
  onPick: (dial: string) => void;
  options: { code: string; dial: string; flag: string; name: string }[];
  selectLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const selected = options.find((o) => o.dial === dial);
  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/^\+/, '');
  const filtered = q
    ? options.filter((o) =>
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().startsWith(q) ||
        (qDigits !== '' && o.dial.startsWith(qDigits)),
      )
    : options;

  function pick(d: string) {
    onPick(d);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex' }}>
      <button
        type="button"
        aria-label="Country code"
        onClick={() => { setOpen((o) => !o); setActive(0); }}
        style={{
          border: 'none',
          background: 'var(--jnj-track)',
          padding: '0 10px',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--jnj-text)',
          cursor: 'pointer',
          outline: 'none',
          borderRight: '1px solid var(--jnj-border)',
          borderTopLeftRadius: 8,
          borderBottomLeftRadius: 8,
          minWidth: 96,
          maxWidth: 140,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? `${selected.flag} +${selected.dial}` : (selectLabel ?? 'Select')}
        </span>
        <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 40,
            marginTop: 4,
            width: 280,
            maxWidth: '80vw',
            background: 'var(--jnj-surface)',
            border: '1px solid var(--jnj-border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) pick(filtered[active].dial); }
              else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
            }}
            placeholder={selectLabel ?? 'Select'}
            autoComplete="off"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: 'none',
              borderBottom: '1px solid var(--jnj-border)',
              outline: 'none',
              padding: '10px 12px',
              fontSize: 15,
              background: 'var(--jnj-track)',
              color: 'var(--jnj-text)',
            }}
          />
          <ul style={{ listStyle: 'none', margin: 0, padding: 4, maxHeight: 260, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <li style={{ padding: '10px 12px', color: 'var(--jnj-text-muted)', fontSize: 14 }}>—</li>
            ) : (
              filtered.map((o, i) => (
                <li
                  key={o.code}
                  onMouseDown={(e) => { e.preventDefault(); pick(o.dial); }}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 15,
                    color: 'var(--jnj-text)',
                    background: i === active ? 'var(--jnj-track)' : 'transparent',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {o.flag} +{o.dial} {o.name}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function parseWhatsApp(raw: string, defaultDial: string): { dial: string; number: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { dial: defaultDial, number: '' };
  const m = trimmed.match(/^\+(\d{1,4})\s*(.*)$/);
  if (m) return { dial: m[1], number: m[2].trim() };
  return { dial: defaultDial, number: trimmed };
}

// 업로드 전 이미지 압축 — 긴 변을 maxDim 으로 줄이고 JPEG 품질을 낮춰가며 targetBytes 이하로 맞춘다.
export async function compressImage(
  file: File,
  opts: { maxDim: number; targetBytes: number },
): Promise<File> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, opts.maxDim / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas context');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  while (blob && blob.size > opts.targetBytes && quality > 0.4) {
    quality = Math.round((quality - 0.1) * 100) / 100;
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }
  if (!blob) throw new Error('compress failed');
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="jnj-field">
      <span className="jnj-label">{label}</span>
      {children}
    </label>
  );
}

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const baseBtn: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.08em',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--jnj-text-muted)',
    transition: 'all 200ms',
  };
  const activeBtn: React.CSSProperties = {
    ...baseBtn,
    color: 'var(--jnj-text)',
    background: 'var(--jnj-surface)',
    borderRadius: 9999,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  };
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: 4,
        background: 'var(--jnj-track)',
        border: '1px solid var(--jnj-border)',
        borderRadius: 9999,
        alignSelf: 'flex-end',
        marginLeft: 'auto',
      }}
    >
      <button type="button" onClick={() => onChange('en')} aria-pressed={lang === 'en'} style={lang === 'en' ? activeBtn : baseBtn}>
        EN
      </button>
      <button type="button" onClick={() => onChange('ko')} aria-pressed={lang === 'ko'} style={lang === 'ko' ? activeBtn : baseBtn}>
        KO
      </button>
    </div>
  );
}

export function PhotoPreview({ url, emptyLabel = 'No photo' }: { url: string; emptyLabel?: string }) {
  if (!url) {
    return (
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 12,
          background: 'var(--jnj-track)',
          border: '1px dashed var(--jnj-border)',
          color: 'var(--jnj-text-muted)',
          fontSize: 12,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {emptyLabel}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      style={{ width: 96, height: 96, borderRadius: 12, objectFit: 'cover', background: 'var(--jnj-track)', flexShrink: 0 }}
    />
  );
}
