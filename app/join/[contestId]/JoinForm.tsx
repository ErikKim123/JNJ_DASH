'use client';

// 참가자 신청 폼 — BASIC + PROFILE.
// 사진 업로드는 /api/join/[contestId]/photo, 제출은 /api/join/[contestId]/submit.
// 제출 성공 시 /join/[contestId]/done?num={번호} 로 이동.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ParticipantRole } from '@/lib/db/types';
import { normalizePhotoUrl } from '@/lib/photo';

type Lang = 'ko' | 'en';

const ROLE_OPTIONS: { value: ParticipantRole; label: string }[] = [
  { value: 'leader', label: 'Leader' },
  { value: 'follower', label: 'Follower' },
];

// 부문/장르 선택지 — value 와 라벨 모두 영문 단일 키 (대회 운영 표준 명칭).
const CATEGORY_OPTIONS: { value: string; label: { ko: string; en: string } }[] = [
  { value: 'Jack & Jill', label: { ko: 'Jack & Jill', en: 'Jack & Jill' } },
  { value: 'Battle', label: { ko: 'Battle', en: 'Battle' } },
  { value: 'Competition', label: { ko: 'Competition', en: 'Competition' } },
];

const GENRE_OPTIONS: { value: string; label: { ko: string; en: string } }[] = [
  { value: 'Salsa', label: { ko: 'Salsa', en: 'Salsa' } },
  { value: 'Bachata', label: { ko: 'Bachata', en: 'Bachata' } },
  { value: 'Kizomba', label: { ko: 'Kizomba', en: 'Kizomba' } },
  { value: 'Zouk', label: { ko: 'Zouk', en: 'Zouk' } },
];

const DIVISION_OPTIONS: { value: string; label: { ko: string; en: string } }[] = [
  { value: 'Solo', label: { ko: 'Solo', en: 'Solo' } },
  { value: 'Couple', label: { ko: 'Couple', en: 'Couple' } },
  { value: 'Team', label: { ko: 'Team', en: 'Team' } },
];

const PROFILE_FIELDS: {
  key: string;
  label: { ko: string; en: string };
  placeholder?: { ko: string; en: string };
  type?: 'text' | 'email' | 'date' | 'tel' | 'whatsapp' | 'select';
  options?: { value: string; label: { ko: string; en: string } }[];
  required?: boolean;
}[] = [
  { key: '부문', label: { ko: '부문', en: 'Category' }, type: 'select', options: CATEGORY_OPTIONS, placeholder: { ko: '부문 선택', en: 'Select category' } },
  { key: '장르', label: { ko: '장르', en: 'Genre' }, type: 'select', options: GENRE_OPTIONS, placeholder: { ko: '장르 선택', en: 'Select genre' } },
  { key: 'Division', label: { ko: '구분', en: 'Division' }, type: 'select', options: DIVISION_OPTIONS, placeholder: { ko: '구분 선택', en: 'Select division' } },
  // '연락처'(WhatsApp)와 '이메일'은 BASIC 섹션으로 이동 — 아래 렌더에서 직접 처리.
  // '접수일'은 폼에 노출하지 않고 등록 시 자동으로 오늘 날짜로 저장된다(meta 초기값).
  { key: 'X', label: { ko: '인스타 (@)', en: 'Instagram (@)' }, placeholder: { ko: '@your_id', en: '@your_id' } },
];

// WhatsApp 국가 코드 — 라틴/아시아/북미/유럽 위주.
// 라벨은 "국기 +코드 국가명" 포맷. dial 은 + 제외 숫자.
const COUNTRY_CODES: { code: string; dial: string; flag: string; name: string }[] = [
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
  // ── 그 외 전 세계 국가 (알파벳순) ──
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

const T = {
  basic: { ko: 'Basic', en: 'Basic' },
  profile: { ko: 'Profile', en: 'Profile' },
  uploadPhoto: { ko: '사진 업로드', en: 'Upload Photo' },
  uploading: { ko: '업로드 중…', en: 'Uploading…' },
  photoHint: {
    ko: '얼굴이 잘 보이는 사진을 올려주세요 · JPEG / PNG / WebP',
    en: 'Please upload a photo with your face clearly visible · JPEG / PNG / WebP',
  },
  noPhoto: { ko: '사진 없음', en: 'No photo' },
  numLabel: { ko: '참가 번호 (자동 부여)', en: 'Entry Number (auto)' },
  roleLabel: { ko: '역할 (Role)', en: 'Role' },
  firstNameLabel: { ko: '이름 (First name · 필수)', en: 'First name (required)' },
  firstNamePlaceholder: { ko: '이름', en: 'First name' },
  lastNameLabel: { ko: '성 (Last name · 필수)', en: 'Last name (required)' },
  lastNamePlaceholder: { ko: '성', en: 'Last name' },
  repLabel: { ko: '국가 (필수)', en: 'Country (required)' },
  repPlaceholder: { ko: '국가 선택', en: 'Select country' },
  submit: { ko: '신청하기', en: 'Submit Entry' },
  submitting: { ko: '제출 중…', en: 'Submitting…' },
  errTeam: { ko: '이름(First name)을 입력해주세요.', en: 'Please enter a first name.' },
  errLastName: { ko: '성(Last name)을 입력해주세요.', en: 'Please enter a last name.' },
  errRep: { ko: '국가를 입력해주세요.', en: 'Please enter a country.' },
  errEmail: { ko: '이메일을 입력해주세요.', en: 'Please enter an email.' },
  errEmailFormat: { ko: '올바른 이메일 형식이 아닙니다.', en: 'Please enter a valid email.' },
  errPhone: { ko: '연락처(WhatsApp)를 입력해주세요.', en: 'Please enter your WhatsApp number.' },
  errDuplicate: {
    ko: '이미 등록된 연락처 또는 이메일입니다. 기존에 보내드린 확인 이메일을 확인해주세요.',
    en: 'This number or email is already registered. Please check the confirmation email we sent you earlier.',
  },
  errFileSize: { ko: '파일이 너무 큽니다 (최대 5MB).', en: 'File too large (max 5MB).' },
  errFileType: { ko: '이미지 파일만 업로드 가능합니다 (jpeg/png/webp/gif).', en: 'Only image files allowed (jpeg/png/webp/gif).' },
  errNet: { ko: '네트워크 오류', en: 'Network error' },
  errPhoto: { ko: '사진 업로드 실패', en: 'Photo upload failed' },
  errSubmit: { ko: '신청 실패', en: 'Submission failed' },
} as const;

function t(key: keyof typeof T, lang: Lang): string {
  return T[key][lang];
}

interface Draft {
  first_name: string;
  last_name: string;
  representative: string;
  role: ParticipantRole;
  photo_url: string;
  meta: Record<string, string>;
}

const todayIso = () => {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export function JoinForm({
  contestId,
  suggestedNum,
}: {
  contestId: string;
  suggestedNum: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [draft, setDraft] = useState<Draft>({
    first_name: '',
    last_name: '',
    representative: '',
    role: 'leader',
    photo_url: '',
    meta: { 접수일: todayIso() },
  });
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setMeta(k: string, v: string) {
    setDraft((d) => ({ ...d, meta: { ...d.meta, [k]: v } }));
  }

  async function uploadPhoto(file: File) {
    setError(null);
    if (!/^image\//.test(file.type)) {
      setError(t('errFileType', lang));
      return;
    }
    // 메모리 보호용 상한 — 이보다 큰 원본은 거부(브라우저 디코딩 부담).
    if (file.size > 40 * 1024 * 1024) {
      setError(t('errFileSize', lang));
      return;
    }
    setPhotoBusy(true);
    try {
      // 큰 사진도 받기 위해 업로드 전 클라이언트에서 리사이즈·압축한다.
      // GIF(애니메이션)는 압축 시 깨질 수 있어 원본을 그대로 사용.
      let toUpload = file;
      if (file.type !== 'image/gif') {
        try {
          toUpload = await compressImage(file, { maxDim: 1600, targetBytes: 3 * 1024 * 1024 });
        } catch {
          toUpload = file; // 압축 실패 시 원본으로 시도
        }
      }
      // 압축 후에도 서버 한도(5MB)를 넘으면 거부 — 보통 GIF/특수 케이스.
      if (toUpload.size > 5 * 1024 * 1024) {
        setError(t('errFileSize', lang));
        return;
      }
      if (!/^image\/(jpeg|png|webp|gif)$/.test(toUpload.type)) {
        setError(t('errFileType', lang));
        return;
      }
      const fd = new FormData();
      fd.append('file', toUpload);
      const res = await fetch(`/api/join/${encodeURIComponent(contestId)}/photo`, {
        method: 'POST',
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) {
        setError(j.error ?? `${t('errPhoto', lang)} (${res.status})`);
        return;
      }
      setField('photo_url', j.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errNet', lang));
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit() {
    setError(null);
    if (!draft.first_name.trim()) { setError(t('errTeam', lang)); return; }
    if (!draft.last_name.trim()) { setError(t('errLastName', lang)); return; }
    if (!draft.representative.trim()) { setError(t('errRep', lang)); return; }
    // 연락처(WhatsApp) 필수 — 국가코드 외에 숫자 5자리 이상 입력해야 통과.
    const phoneDigits = (draft.meta['연락처'] ?? '').replace(/\D/g, '');
    if (phoneDigits.length < 5) { setError(t('errPhone', lang)); return; }
    const email = (draft.meta['이메일'] ?? '').trim();
    if (!email) { setError(t('errEmail', lang)); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t('errEmailFormat', lang)); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/join/${encodeURIComponent(contestId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: draft.first_name.trim(),
          last_name: draft.last_name.trim(),
          representative: draft.representative.trim(),
          role: draft.role,
          photo_url: draft.photo_url,
          meta: draft.meta,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.data) {
        // 중복 등록(409) — 저장하지 않고 기존 확인 메일을 안내한다.
        if (j.error === 'DUPLICATE') { setError(t('errDuplicate', lang)); return; }
        if (j.error === 'PHONE_REQUIRED') { setError(t('errPhone', lang)); return; }
        setError(j.error ?? `${t('errSubmit', lang)} (${res.status})`);
        return;
      }
      const assignedNum = (j.data.num as string) ?? suggestedNum;
      // 메일 결과를 query 로 전달 — done 페이지에서 발송 상태 표시.
      // sent=1 / sent=0&reason=... 형태.
      const params = new URLSearchParams({ num: assignedNum });
      const emailRes = j.email as { sent?: boolean; reason?: string } | undefined;
      if (emailRes) {
        if (emailRes.sent) {
          params.set('mail', '1');
          if (draft.meta['이메일']) params.set('to', draft.meta['이메일']);
        } else if (emailRes.reason) {
          params.set('mail', '0');
          params.set('reason', emailRes.reason);
        }
      }
      router.push(`/join/${encodeURIComponent(contestId)}/done?${params.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errNet', lang));
    } finally {
      setBusy(false);
    }
  }

  const photoPreview = draft.photo_url ? normalizePhotoUrl(draft.photo_url) : '';

  return (
    <div className="jnj-stack-6">
      {/* Language toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      {/* BASIC */}
      <section>
        <h2 className="jnj-section-title">{t('basic', lang)}</h2>
        <div className="jnj-card jnj-stack-4">
          {/* Photo */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <PhotoPreview url={photoPreview} emptyLabel={t('noPhoto', lang)} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(f);
                }}
              />
              <button
                type="button"
                className="jnj-btn jnj-btn-secondary"
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
              >
                {photoBusy ? t('uploading', lang) : t('uploadPhoto', lang)}
              </button>
              <p className="jnj-small">{t('photoHint', lang)}</p>
            </div>
          </div>

          <Field label={t('roleLabel', lang)}>
            <select
              className="jnj-input jnj-select"
              value={draft.role}
              onChange={(e) => setField('role', e.target.value as ParticipantRole)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>

          <Field label={t('firstNameLabel', lang)}>
            <input
              type="text"
              className="jnj-input"
              value={draft.first_name}
              onChange={(e) => setField('first_name', e.target.value)}
              placeholder={t('firstNamePlaceholder', lang)}
              maxLength={200}
            />
          </Field>

          <Field label={t('lastNameLabel', lang)}>
            <input
              type="text"
              className="jnj-input"
              value={draft.last_name}
              onChange={(e) => setField('last_name', e.target.value)}
              placeholder={t('lastNamePlaceholder', lang)}
              maxLength={200}
            />
          </Field>

          <Field label={lang === 'ko' ? '연락처 (필수)' : 'WhatsApp Number (required)'}>
            <WhatsAppInput
              value={draft.meta['연락처'] ?? ''}
              onChange={(v) => setMeta('연락처', v)}
              placeholder={lang === 'ko' ? '010-0000-0000' : '10-1234-5678'}
              selectLabel={lang === 'ko' ? '국가 선택' : 'Select'}
              defaultDial=""
            />
          </Field>

          <Field label={t('repLabel', lang)}>
            <CountrySelect
              value={draft.representative}
              onChange={(v) => setField('representative', v)}
              placeholder={t('repPlaceholder', lang)}
              options={COUNTRY_CODES}
            />
          </Field>

          {/* '이메일'은 PROFILE 에서 BASIC 으로 이동 — 확인 메일 수신 주소임을 안내. */}
          <Field label={lang === 'ko' ? '이메일 (필수)' : 'Email (required)'}>
            <input
              type="email"
              className="jnj-input"
              value={draft.meta['이메일'] ?? ''}
              onChange={(e) => setMeta('이메일', e.target.value)}
              placeholder="name@example.com"
              maxLength={2048}
            />
            <p className="jnj-small">
              {lang === 'ko'
                ? '확인 메일을 받으실 주소입니다.'
                : 'Where you will receive your confirmation mail'}
            </p>
          </Field>
        </div>
      </section>

      {/* PROFILE */}
      <section>
        <h2 className="jnj-section-title">{t('profile', lang)}</h2>
        <div className="jnj-card jnj-stack-4">
          {PROFILE_FIELDS.map((f) => (
            <Field key={f.key} label={f.label[lang]}>
              {f.type === 'whatsapp' ? (
                <WhatsAppInput
                  value={draft.meta[f.key] ?? ''}
                  onChange={(v) => setMeta(f.key, v)}
                  placeholder={f.placeholder ? f.placeholder[lang] : ''}
                  selectLabel={lang === 'ko' ? '국가 선택' : 'Select'}
                  defaultDial=""
                />
              ) : f.type === 'select' && f.options ? (
                <select
                  className="jnj-input jnj-select"
                  value={draft.meta[f.key] ?? ''}
                  onChange={(e) => setMeta(f.key, e.target.value)}
                >
                  <option value="">{f.placeholder ? f.placeholder[lang] : ''}</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label[lang]}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type ?? 'text'}
                  className="jnj-input"
                  value={draft.meta[f.key] ?? ''}
                  onChange={(e) => setMeta(f.key, e.target.value)}
                  placeholder={f.placeholder ? f.placeholder[lang] : ''}
                  maxLength={2048}
                />
              )}
            </Field>
          ))}
        </div>
      </section>

      {error && (
        <p
          role="alert"
          style={{
            color: 'var(--jnj-red)',
            fontSize: 14,
            margin: 0,
            padding: '12px 16px',
            background: 'rgba(211, 0, 5, 0.10)',
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      )}

      {/* Submit (sticky bottom) */}
      <div
        style={{
          position: 'sticky',
          bottom: 16,
          paddingTop: 16,
          background: 'linear-gradient(to top, var(--jnj-bg) 70%, transparent)',
        }}
      >
        <button
          type="button"
          onClick={submit}
          disabled={busy || photoBusy}
          className="jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg"
        >
          {busy ? t('submitting', lang) : t('submit', lang)}
        </button>
      </div>
    </div>
  );
}

// 검색 가능한 국가 선택 — 국가가 많아 네이티브 select 대신 타이핑 필터 콤보박스.
// 'k' 입력 시 Korea 등 이름/코드에 매칭되는 국가만 노출. 값은 국가명(name)을 저장.
function CountrySelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { code: string; flag: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기.
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
  // 이름은 부분일치, 코드(KR 등)는 접두 일치.
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
function WhatsAppInput({
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
      // 국가 코드 미선택 시에는 번호만 저장(접두 코드 없이).
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
      <DialCodeSelect
        dial={dial}
        onPick={(d) => update(d, number)}
        options={COUNTRY_CODES}
        selectLabel={selectLabel}
      />
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

// 검색 가능한 국가 전화코드 선택 — 코드가 많아 트리거 클릭 시 검색창 + 필터 목록을 띄운다.
// 표시: "🇰🇷 +82" / 목록: "🇰🇷 +82 Korea". 이름·코드(KR)·다이얼(82) 모두 검색.
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
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 4,
              maxHeight: 260,
              overflowY: 'auto',
            }}
          >
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

// 업로드 전 이미지 압축 — 긴 변을 maxDim 으로 줄이고 JPEG 품질을 낮춰가며
// targetBytes 이하로 맞춘다. 브라우저 Canvas 만 사용(외부 의존성 없음).
async function compressImage(
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
  // 투명 PNG → JPEG 변환 시 검정 배경이 되는 것을 막기 위해 흰색으로 채운다.
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

function parseWhatsApp(raw: string, defaultDial: string): { dial: string; number: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { dial: defaultDial, number: '' };
  const m = trimmed.match(/^\+(\d{1,4})\s*(.*)$/);
  if (m) return { dial: m[1], number: m[2].trim() };
  return { dial: defaultDial, number: trimmed };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="jnj-field">
      <span className="jnj-label">{label}</span>
      {children}
    </label>
  );
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
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
      <button
        type="button"
        onClick={() => onChange('en')}
        aria-pressed={lang === 'en'}
        style={lang === 'en' ? activeBtn : baseBtn}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange('ko')}
        aria-pressed={lang === 'ko'}
        style={lang === 'ko' ? activeBtn : baseBtn}
      >
        KO
      </button>
    </div>
  );
}

function PhotoPreview({ url, emptyLabel = 'No photo' }: { url: string; emptyLabel?: string }) {
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
      style={{
        width: 96,
        height: 96,
        borderRadius: 12,
        objectFit: 'cover',
        background: 'var(--jnj-track)',
        flexShrink: 0,
      }}
    />
  );
}
