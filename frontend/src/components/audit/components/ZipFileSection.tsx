import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Info } from "lucide-react";
import type { ZipFileMeta } from "@/shared/utils/zipStorage";
import { formatFileSize } from "../hooks/useZipFile";

interface ZipFileSectionProps {
  loading: boolean;
  storedZipInfo: ZipFileMeta | null;
  useStoredZip: boolean;
  zipFile: File | null;
  onSwitchToStored: () => void;
  onSwitchToUpload: () => void;
  onFileSelect: (file: File | null, input?: HTMLInputElement) => void;
}

export default function ZipFileSection({
  loading,
  storedZipInfo,
  useStoredZip,
  zipFile,
  onSwitchToStored,
  onSwitchToUpload,
  onFileSelect,
}: ZipFileSectionProps) {
  if (loading) {
    return (
      <div className="bg-amber-50 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center space-x-3 p-4 bg-blue-50 border-2 border-black">
          <div className="animate-spin rounded-none h-5 w-5 border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-blue-800 font-bold">正在检查ZIP文件...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="space-y-3">
        {storedZipInfo?.has_file ? (
          <StoredZipView
            storedZipInfo={storedZipInfo}
            useStoredZip={useStoredZip}
            zipFile={zipFile}
            onSwitchToStored={onSwitchToStored}
            onSwitchToUpload={onSwitchToUpload}
            onFileSelect={onFileSelect}
          />
        ) : (
          <NoStoredZipView onFileSelect={onFileSelect} />
        )}
      </div>
    </div>
  );
}

function StoredZipView({
  storedZipInfo,
  useStoredZip,
  zipFile,
  onSwitchToStored,
  onSwitchToUpload,
  onFileSelect,
}: {
  storedZipInfo: ZipFileMeta;
  useStoredZip: boolean;
  zipFile: File | null;
  onSwitchToStored: () => void;
  onSwitchToUpload: () => void;
  onFileSelect: (file: File | null, input?: HTMLInputElement) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start space-x-3 p-4 bg-green-50 border-2 border-black">
        <Info className="w-5 h-5 text-green-600 mt-0.5" />
        <div className="flex-1">
          <p className="font-bold text-green-900 text-sm uppercase">
            已有存储的ZIP文件
          </p>
          <p className="text-xs text-green-700 mt-1 font-bold">
            文件名: {storedZipInfo.original_filename}
            {storedZipInfo.file_size && (
              <> ({formatFileSize(storedZipInfo.file_size)})</>
            )}
          </p>
          {storedZipInfo.uploaded_at && (
            <p className="text-xs text-green-600 mt-0.5">
              上传时间:{" "}
              {new Date(storedZipInfo.uploaded_at).toLocaleString("zh-CN")}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="radio"
            checked={useStoredZip}
            onChange={onSwitchToStored}
            className="w-4 h-4"
          />
          <span className="text-sm font-bold">使用已存储的文件</span>
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="radio"
            checked={!useStoredZip}
            onChange={onSwitchToUpload}
            className="w-4 h-4"
          />
          <span className="text-sm font-bold">上传新文件</span>
        </label>
      </div>

      {!useStoredZip && (
        <div className="space-y-2 pt-2 border-t border-amber-300">
          <Label htmlFor="zipFile" className="font-bold uppercase">
            选择新的ZIP文件
          </Label>
          <Input
            id="zipFile"
            type="file"
            accept=".zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              onFileSelect(file || null, e.target);
            }}
            className="cursor-pointer retro-input pt-1.5"
          />
          {zipFile && (
            <p className="text-xs text-amber-700 font-bold">
              新文件: {zipFile.name} ({formatFileSize(zipFile.size)})
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NoStoredZipView({
  onFileSelect,
}: {
  onFileSelect: (file: File | null, input?: HTMLInputElement) => void;
}) {
  return (
    <>
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
        <div>
          <p className="font-bold text-amber-900 text-sm uppercase">
            需要上传ZIP文件
          </p>
          <p className="text-xs text-amber-700 mt-1 font-bold">
            此项目还没有存储的ZIP文件，请上传文件进行扫描
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="zipFile" className="font-bold uppercase">
          上传ZIP文件
        </Label>
        <Input
          id="zipFile"
          type="file"
          accept=".zip"
          onChange={(e) => {
            const file = e.target.files?.[0];
            onFileSelect(file || null, e.target);
          }}
          className="cursor-pointer retro-input pt-1.5"
        />
      </div>
    </>
  );
}
