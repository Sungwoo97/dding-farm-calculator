import {
  USER_DATA_SCHEMA_VERSION,
  userDataExportSchema,
  type UserDataExport,
} from './schema'
import { userSettingsRepository } from './repository'

export async function exportUserData(): Promise<string> {
  const [profile, materials, favorites, catalogCache] = await Promise.all([
    userSettingsRepository.loadProfile(),
    userSettingsRepository.listMaterials(),
    userSettingsRepository.listFavorites(),
    userSettingsRepository.getCatalogCache(),
  ])

  return JSON.stringify({
    schemaVersion: USER_DATA_SCHEMA_VERSION,
    profile,
    materials,
    favorites,
    catalogCache,
  } satisfies UserDataExport)
}

export async function importUserData(json: string): Promise<void> {
  let input: unknown
  try {
    input = JSON.parse(json)
  } catch {
    throw new Error('Invalid user data: malformed JSON')
  }

  if (
    typeof input === 'object' &&
    input !== null &&
    'schemaVersion' in input &&
    typeof input.schemaVersion === 'number' &&
    input.schemaVersion > USER_DATA_SCHEMA_VERSION
  ) {
    throw new Error(`Unsupported user-data schema version: ${input.schemaVersion}`)
  }

  let data: UserDataExport
  try {
    data = userDataExportSchema.parse(input)
  } catch {
    throw new Error('Invalid user data')
  }

  await userSettingsRepository.replaceAll(data)
}
