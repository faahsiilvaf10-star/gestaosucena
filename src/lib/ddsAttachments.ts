import { supabase } from './supabase'

export interface DdsAttachment {
  id: string
  name: string
  url: string
  fileType: 'pdf' | 'image' | 'doc' | 'sheet' | 'other'
  size?: number
  uploadedAt: string
  uploadedBy?: string
  date?: string // YYYY-MM-DD (data do DDS ao qual o arquivo está vinculado)
  description?: string
  environment?: string
}

const GLOBAL_SETTINGS_KEY_PREFIX = 'dds_attachments'

export function getSettingsKey(environment?: string): string {
  const env = environment || (typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
  return `${GLOBAL_SETTINGS_KEY_PREFIX}_${env}`
}

function detectFileType(file: File): 'pdf' | 'image' | 'doc' | 'sheet' | 'other' {
  const name = file.name.toLowerCase()
  const mime = file.type.toLowerCase()

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf'
  }
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(name)) {
    return 'image'
  }
  if (/\.(docx?|odt|txt|rtf)$/i.test(name)) {
    return 'doc'
  }
  if (/\.(xlsx?|csv|ods)$/i.test(name)) {
    return 'sheet'
  }
  return 'other'
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
  })
}

/**
 * Busca todos os anexos e PDFs de DDS salvos no banco de dados para o ambiente
 */
export async function getDdsAttachments(environment?: string): Promise<DdsAttachment[]> {
  try {
    const key = getSettingsKey(environment)
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error) {
      console.warn('[ddsAttachments] Erro ao carregar anexos do banco:', error)
      return []
    }

    if (data && Array.isArray(data.value)) {
      return data.value as DdsAttachment[]
    }

    return []
  } catch (err) {
    console.warn('[ddsAttachments] Exceção ao ler anexos:', err)
    return []
  }
}

/**
 * Salva um ou mais anexos no banco de dados
 */
export async function saveDdsAttachments(
  newAttachments: DdsAttachment[],
  environment?: string
): Promise<boolean> {
  try {
    const key = getSettingsKey(environment)
    const current = await getDdsAttachments(environment)
    
    // Mesclar mantendo os novos e atualizados no topo
    const updatedMap = new Map<string, DdsAttachment>()
    newAttachments.forEach(att => updatedMap.set(att.id, att))
    current.forEach(att => {
      if (!updatedMap.has(att.id)) {
        updatedMap.set(att.id, att)
      }
    })

    const mergedList = Array.from(updatedMap.values()).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )

    const { error } = await supabase
      .from('global_settings')
      .upsert({
        key,
        value: mergedList,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('[ddsAttachments] Erro ao persistir anexos:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[ddsAttachments] Falha geral ao salvar anexos:', err)
    return false
  }
}

/**
 * Exclui um anexo pelo ID
 */
export async function deleteDdsAttachment(
  attachmentId: string,
  environment?: string
): Promise<boolean> {
  try {
    const key = getSettingsKey(environment)
    const current = await getDdsAttachments(environment)
    const filtered = current.filter(a => a.id !== attachmentId)

    const { error } = await supabase
      .from('global_settings')
      .upsert({
        key,
        value: filtered,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('[ddsAttachments] Erro ao excluir anexo:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[ddsAttachments] Falha ao excluir anexo:', err)
    return false
  }
}

/**
 * Realiza o upload do arquivo para o Supabase Storage com fallback
 */
export async function uploadDdsFile(
  file: File,
  dateStr?: string,
  environment?: string
): Promise<{ url: string; name: string; fileType: DdsAttachment['fileType']; size: number }> {
  const fileType = detectFileType(file)
  const fileExt = file.name.split('.').pop() || (fileType === 'pdf' ? 'pdf' : 'bin')
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = Date.now()
  const dateFolder = dateStr || 'geral'
  const filePath = `dds/${dateFolder}/${timestamp}_${sanitizedName}`

  // 1. Tentar bucket 'posts'
  try {
    const { error: postError } = await supabase.storage
      .from('posts')
      .upload(filePath, file, { upsert: true })

    if (!postError) {
      const { data } = supabase.storage.from('posts').getPublicUrl(filePath)
      if (data?.publicUrl) {
        return {
          url: data.publicUrl,
          name: file.name,
          fileType,
          size: file.size
        }
      }
    }
  } catch (err) {
    console.warn('[ddsAttachments] Falha storage posts:', err)
  }

  // 2. Tentar bucket 'documentos_cargos'
  try {
    const { error: docError } = await supabase.storage
      .from('documentos_cargos')
      .upload(filePath, file, { upsert: true })

    if (!docError) {
      const { data } = supabase.storage.from('documentos_cargos').getPublicUrl(filePath)
      if (data?.publicUrl) {
        return {
          url: data.publicUrl,
          name: file.name,
          fileType,
          size: file.size
        }
      }
    }
  } catch (err) {
    console.warn('[ddsAttachments] Falha storage documentos_cargos:', err)
  }

  // 3. Fallback: Base64 data URL se for até 8MB
  if (file.size <= 8 * 1024 * 1024) {
    const base64Url = await fileToBase64(file)
    return {
      url: base64Url,
      name: file.name,
      fileType,
      size: file.size
    }
  }

  throw new Error('Não foi possível armazenar o arquivo. Limite de tamanho excedido (máx 8MB).')
}
