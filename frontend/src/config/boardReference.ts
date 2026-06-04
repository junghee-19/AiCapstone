import { defectDisplayName } from '@/types/inspection'

export interface BoardReference {
  key: string
  label: string
  imageUrl: string
  expectedCounts: Record<string, number>
  components?: BoardReferenceComponent[]
}

export interface BoardReferenceComponent {
  id: string
  cls: string
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
}

// 확장 포인트:
// - 다른 기판이 추가되면 아래 배열에 항목만 추가하면 UI 선택 목록에 자동 반영된다.
export const BOARD_REFERENCES: BoardReference[] = [
  {
    key: 'GT_125A',
    label: 'GT-125A',
    imageUrl: '/board-ref/gt125a_ref.png',
    expectedCounts: {
      mount_hole: 4,
      fiducial: 2,
      gold_finger_row: 2,
      ic_chip: 8,
      smd_array_block: 2,
      edge_connector_zone: 2,
    },
    components: [
      { id: 'mount_hole_1', cls: 'mount_hole', bbox: { x: 74, y: 39, width: 36, height: 36 } },
      { id: 'mount_hole_2', cls: 'mount_hole', bbox: { x: 695, y: 36, width: 37, height: 37 } },
      { id: 'mount_hole_3', cls: 'mount_hole', bbox: { x: 83, y: 482, width: 35, height: 36 } },
      { id: 'mount_hole_4', cls: 'mount_hole', bbox: { x: 698, y: 470, width: 36, height: 36 } },
      { id: 'fiducial_1', cls: 'fiducial', bbox: { x: 88, y: 446, width: 25, height: 25 } },
      { id: 'fiducial_2', cls: 'fiducial', bbox: { x: 698, y: 90, width: 25, height: 25 } },
      { id: 'gold_finger_row_1', cls: 'gold_finger_row', bbox: { x: 143, y: 236, width: 516, height: 40 } },
      { id: 'gold_finger_row_2', cls: 'gold_finger_row', bbox: { x: 144, y: 281, width: 520, height: 42 } },
      { id: 'ic_chip_1', cls: 'ic_chip', bbox: { x: 193, y: 92, width: 60, height: 84 } },
      { id: 'ic_chip_2', cls: 'ic_chip', bbox: { x: 255, y: 92, width: 61, height: 84 } },
      { id: 'ic_chip_3', cls: 'ic_chip', bbox: { x: 318, y: 92, width: 60, height: 84 } },
      { id: 'ic_chip_4', cls: 'ic_chip', bbox: { x: 381, y: 92, width: 59, height: 84 } },
      { id: 'ic_chip_5', cls: 'ic_chip', bbox: { x: 232, y: 419, width: 63, height: 55 } },
      { id: 'ic_chip_6', cls: 'ic_chip', bbox: { x: 296, y: 419, width: 62, height: 55 } },
      { id: 'ic_chip_7', cls: 'ic_chip', bbox: { x: 358, y: 419, width: 61, height: 55 } },
      { id: 'ic_chip_8', cls: 'ic_chip', bbox: { x: 421, y: 420, width: 61, height: 54 } },
      { id: 'smd_array_block_1', cls: 'smd_array_block', bbox: { x: 192, y: 168, width: 465, height: 68 } },
      { id: 'smd_array_block_2', cls: 'smd_array_block', bbox: { x: 165, y: 322, width: 499, height: 70 } },
      { id: 'edge_connector_zone_1', cls: 'edge_connector_zone', bbox: { x: 465, y: 22, width: 117, height: 33 } },
      { id: 'edge_connector_zone_2', cls: 'edge_connector_zone', bbox: { x: 475, y: 500, width: 112, height: 40 } },
    ],
  },
]

export function toCountRows(expectedCounts: Record<string, number>) {
  return Object.entries(expectedCounts).map(([cls, count]) => ({
    cls,
    label: defectDisplayName(cls),
    count,
  }))
}

