import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, supabase } from "@/db/supabase";
import { Database, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function DatabaseTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any>(null);

  const testConnection = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        console.error('Database connection test failed:', error);
        return false;
      }
      
      console.log('Database connection successful');
      return true;
    } catch (error) {
      console.error('Database connection error:', error);
      return false;
    }
  };

  const runDatabaseTest = async () => {
    setTesting(true);
    const testResults: any = {
      connection: false,
      tables: {},
      sampleData: {},
      errors: []
    };

    try {
      // 测试基本连接
      console.log('测试数据库连接...');
      testResults.connection = await testConnection();
      
      // 测试各个表
      const tables = ['profiles', 'projects', 'audit_tasks', 'audit_issues', 'instant_analyses'];
      
      for (const table of tables) {
        try {
          console.log(`测试表: ${table}`);
          const { data, error, count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          testResults.tables[table] = {
            accessible: !error,
            count: count || 0,
            error: error?.message
          };
          
          if (error) {
            testResults.errors.push(`${table}: ${error.message}`);
          }
        } catch (err) {
          testResults.tables[table] = {
            accessible: false,
            count: 0,
            error: (err as Error).message
          };
          testResults.errors.push(`${table}: ${(err as Error).message}`);
        }
      }

      // 测试示例数据获取
      try {
        console.log('测试项目数据获取...');
        const projects = await api.getProjects();
        testResults.sampleData.projects = {
          success: true,
          count: projects.length,
          data: projects.slice(0, 2) // 只显示前2个
        };
      } catch (err) {
        testResults.sampleData.projects = {
          success: false,
          error: (err as Error).message
        };
        testResults.errors.push(`项目数据: ${(err as Error).message}`);
      }

      setResults(testResults);
      
      if (testResults.connection && testResults.errors.length === 0) {
        toast.success("数据库测试通过！");
      } else {
        toast.error(`数据库测试发现 ${testResults.errors.length} 个问题`);
      }
      
    } catch (error) {
      console.error('数据库测试失败:', error);
      testResults.errors.push(`总体测试失败: ${(error as Error).message}`);
      setResults(testResults);
      toast.error("数据库测试失败");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="w-5 h-5 mr-2" />
          数据库连接测试
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <Button onClick={runDatabaseTest} disabled={testing}>
            {testing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            {testing ? '测试中...' : '开始测试'}
          </Button>
          
          {results && (
            <Badge variant={results.connection && results.errors.length === 0 ? "default" : "destructive"}>
              {results.connection && results.errors.length === 0 ? (
                <CheckCircle className="w-3 h-3 mr-1" />
              ) : (
                <AlertTriangle className="w-3 h-3 mr-1" />
              )}
              {results.connection && results.errors.length === 0 ? '连接正常' : '存在问题'}
            </Badge>
          )}
        </div>

        {results && (
          <div className="space-y-4">
            {/* 连接状态 */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">基础连接</h4>
              <div className="flex items-center space-x-2">
                {results.connection ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
                <span className={results.connection ? 'text-green-600' : 'text-red-600'}>
                  {results.connection ? '数据库连接成功' : '数据库连接失败'}
                </span>
              </div>
            </div>

            {/* 表状态 */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">数据表状态</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(results.tables).map(([tableName, tableInfo]: [string, any]) => (
                  <div key={tableName} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      {tableInfo.accessible ? (
                        <CheckCircle className="w-3 h-3 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                      )}
                      <span className="text-sm font-medium">{tableName}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {tableInfo.count} 条记录
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* 示例数据 */}
            {results.sampleData.projects && (
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">示例数据</h4>
                {results.sampleData.projects.success ? (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600">
                      ✅ 成功获取 {results.sampleData.projects.count} 个项目
                    </p>
                    {results.sampleData.projects.data.map((project: any, index: number) => (
                      <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                        <strong>{project.name}</strong> - {project.description || '无描述'}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-red-600">
                    ❌ 获取项目数据失败: {results.sampleData.projects.error}
                  </p>
                )}
              </div>
            )}

            {/* 错误信息 */}
            {results.errors.length > 0 && (
              <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">发现的问题</h4>
                <ul className="space-y-1">
                  {results.errors.map((error: string, index: number) => (
                    <li key={index} className="text-sm text-red-700">
                      • {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}