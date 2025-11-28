import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatabaseManager } from "@/components/database/DatabaseManager";
import { SystemConfig } from "@/components/system/SystemConfig";

export default function AdminDashboard() {
  return (
    <div className="flex flex-col gap-6 px-6 py-4 bg-background min-h-screen font-mono relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* 主要内容标签页 */}
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-transparent border-2 border-black p-0 h-auto gap-0 mb-6">
          <TabsTrigger value="config" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">系统配置</TabsTrigger>
          <TabsTrigger value="data" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">数据管理</TabsTrigger>
        </TabsList>

        {/* 系统配置 */}
        <TabsContent value="config" className="flex flex-col gap-6">
          <SystemConfig />
        </TabsContent>

        {/* 数据管理 */}
        <TabsContent value="data" className="space-y-6">
          <DatabaseManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
