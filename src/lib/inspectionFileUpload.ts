import { supabase } from './supabase'

export interface InspectionDocFile {
  url: string
  name: string
  uploadedAt: string
}

export type DocFieldKey = 'opacity_report' | 'mechanical_report' | 'maintenance_plan' | 'tachograph'

export type InspectionFilesRecord = Record<string, Partial<Record<DocFieldKey, InspectionDocFile>>>

const GLOBAL_SETTINGS_KEY = 'equipment_inspection_files'

/**
 * Lê os arquivos de laudos/vistorias salvos no banco de dados
 */
export async function getInspectionFiles(): Promise<InspectionFilesRecord> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', GLOBAL_SETTINGS_KEY)
      .maybeSingle()

    if (error) {
      console.warn('[InspectionFiles] Erro ao carregar arquivos do banco:', error)
      return {}
    }

    if (data && data.value && typeof data.value === 'object') {
      return data.value as InspectionFilesRecord
    }

    return {}
  } catch (err) {
    console.warn('[InspectionFiles] Exceção ao ler arquivos:', err)
    return {}
  }
}

/**
 * Salva ou remove o arquivo de uma vistoria no banco de dados
 */
export async function saveInspectionFile(
  equipmentId: string,
  docType: DocFieldKey,
  fileInfo: InspectionDocFile | null
): Promise<boolean> {
  try {
    // 1. Atualizar em global_settings
    const currentFiles = await getInspectionFiles()
    const eqFiles = { ...(currentFiles[equipmentId] || {}) }

    if (fileInfo) {
      eqFiles[docType] = fileInfo
    } else {
      delete eqFiles[docType]
    }

    const updatedMap: InspectionFilesRecord = {
      ...currentFiles,
      [equipmentId]: eqFiles
    }

    const { error: gsError } = await supabase
      .from('global_settings')
      .upsert({
        key: GLOBAL_SETTINGS_KEY,
        value: updatedMap,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

    if (gsError) {
      console.error('[InspectionFiles] Erro ao salvar em global_settings:', gsError)
    }

    // 2. Tentar atualizar também nas colunas de equipment_inspections (se existirem na tabela)
    try {
      const fieldUrl = `${docType}_file_url`
      const fieldName = `${docType}_file_name`
      await supabase
        .from('equipment_inspections')
        .update({
          [fieldUrl]: fileInfo ? fileInfo.url : null,
          [fieldName]: fileInfo ? fileInfo.name : null,
          updated_at: new Date().toISOString()
        })
        .eq('equipment_id', equipmentId)
    } catch {
      // Ignora erro se as colunas ainda não foram migradas no banco
    }

    return true
  } catch (err) {
    console.error('[InspectionFiles] Erro geral ao salvar arquivo:', err)
    return false
  }
}

/**
 * Converte arquivo para Base64 Data URL como fallback seguro
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
    reader.readAsDataURL(file)
  })
}

/**
 * Faz o upload de um laudo ou documento para o Supabase Storage
 */
export async function uploadInspectionFile(
  file: File,
  equipmentId: string,
  docType: DocFieldKey
): Promise<{ url: string; name: string }> {
  const fileExt = file.name.split('.').pop() || 'pdf'
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = Date.now()
  const filePath = `vistorias/${equipmentId}/${docType}_${timestamp}.${fileExt}`

  // 1. Tentar bucket 'posts' (público e com upload para autenticados)
  try {
    const { error: postError } = await supabase.storage
      .from('posts')
      .upload(filePath, file, { upsert: true })

    if (!postError) {
      const { data } = supabase.storage.from('posts').getPublicUrl(filePath)
      if (data?.publicUrl) {
        return { url: data.publicUrl, name: file.name }
      }
    }
  } catch (err) {
    console.warn('[InspectionFiles] Falha ao enviar para bucket posts:', err)
  }

  // 2. Tentar bucket 'documentos_cargos'
  try {
    const { error: docError } = await supabase.storage
      .from('documentos_cargos')
      .upload(filePath, file, { upsert: true })

    if (!docError) {
      const { data } = supabase.storage.from('documentos_cargos').getPublicUrl(filePath)
      if (data?.publicUrl) {
        return { url: data.publicUrl, name: file.name }
      }
    }
  } catch (err) {
    console.warn('[InspectionFiles] Falha ao enviar para bucket documentos_cargos:', err)
  }

  // 3. Fallback: Base64 data URL se for arquivo até 4MB
  if (file.size <= 4 * 1024 * 1024) {
    const base64Url = await fileToBase64(file)
    return { url: base64Url, name: file.name }
  }

  throw new Error('Não foi possível armazenar o arquivo. Limite de tamanho excedido ou falha no storage.')
}
