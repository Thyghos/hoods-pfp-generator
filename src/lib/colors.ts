export type HoodColor = {
  id: string
  label: string
  fabric: string
  fabricLight: string
  fabricDark: string
  brim: string
}

export const HOOD_COLORS: HoodColor[] = [
  {
    id: 'lime',
    label: 'Hood green',
    // Matches the site 3D hoodie fabric (UI accent stays #70c810 in BRAND.green)
    fabric: '#50671e',
    fabricLight: '#7a933e',
    fabricDark: '#364c0c',
    brim: '#455a18',
  },
  {
    id: 'black',
    label: 'Shadow',
    fabric: '#1a1a1a',
    fabricLight: '#2e2e2e',
    fabricDark: '#0a0a0a',
    brim: '#111111',
  },
  {
    id: 'forest',
    label: 'Forest',
    fabric: '#2f6b2a',
    fabricLight: '#458a3f',
    fabricDark: '#1a3f18',
    brim: '#245520',
  },
  {
    id: 'maroon',
    label: 'Maroon',
    fabric: '#7a2430',
    fabricLight: '#9a3644',
    fabricDark: '#4a121a',
    brim: '#5c1a24',
  },
  {
    id: 'steel',
    label: 'Steel',
    fabric: '#5a6270',
    fabricLight: '#7a8494',
    fabricDark: '#2f3540',
    brim: '#454c58',
  },
]

export const BRAND = {
  bg: '#050505',
  green: '#70c810',
  greenDim: '#4a8a0c',
  ink: '#f4f4f0',
  muted: '#9a9a92',
  line: 'rgba(244,244,240,0.1)',
  red: '#e23b2c',
  inkDark: '#061400',
} as const
