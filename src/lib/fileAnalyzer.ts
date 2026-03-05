import { analyzeFile } from '@polar3d/file-analyzer'

export interface ColorInfo {
    colors: string[] // Hex color codes
    isMultiColor: boolean
    amsCompatible: boolean // Can be printed with 4-color AMS
}

export interface FileAnalysisResult {
    fileName: string
    fileType: string
    colors: ColorInfo
    layerCount?: number
}

/**
 * Analyze STL/3MF file for colors and metadata
 * Uses @polar3d/file-analyzer
 */
export async function analyzeFileColors(file: File): Promise<FileAnalysisResult> {
    try {
        const result = await analyzeFile(file)

        const colors = result.filamentInfo?.colors || []
        const isMultiColor = result.filamentInfo?.isMultiColor || false

        return {
            fileName: file.name,
            fileType: result.fileType || 'unknown',
            colors: {
                colors: colors.map((c: any) => c.hex || c),
                isMultiColor,
                amsCompatible: colors.length > 0 && colors.length <= 4
            },
            layerCount: result.layerCount
        }
    } catch (error) {
        console.error('Error analyzing file:', error)
        // Return default single-color result
        return {
            fileName: file.name,
            fileType: 'stl',
            colors: {
                colors: ['#ffffff'],
                isMultiColor: false,
                amsCompatible: true
            }
        }
    }
}

/**
 * Extract just the colors from a file
 * Returns array of hex colors, limited to 4 for AMS
 */
export async function extractColors(file: File): Promise<string[]> {
    const analysis = await analyzeFileColors(file)
    const colors = analysis.colors.colors.slice(0, 4) // Limit to 4 for AMS

    // If no colors detected, return default white
    return colors.length > 0 ? colors : ['#ffffff']
}
