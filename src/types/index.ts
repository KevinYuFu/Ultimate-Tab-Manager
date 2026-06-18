export type View = 'navigator' | 'preferences'

export type Tab = {
  id: string
  url: string
  name: string
  favicon: string
  dateAdded: number
  binId: string | null
}

export type Bin = {
  id: string
  name: string
  parentId: string | null
}

export type Settings = {
  themeId: string
  tabs: Tab[]
  bins: Bin[]
}
