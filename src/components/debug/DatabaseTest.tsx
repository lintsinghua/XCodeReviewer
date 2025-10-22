import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  RefreshCw
} from "lucide-react";
import { api } from "@/shared/config/database";
import { toast } from "sonner";

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  duration?: number;
}

export default function DatabaseTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    
    const tests: Array<{ name: string; test: () => Promise<any> }> = [
      {
        name: "数据库连接测试",
        test: async () => {
          const start = Date.now();
          await api.getProjectStats();
          return { duration: Date.now() - start };
        }
      },
      {
        name: "项目数据查询",
        test: async () => {
          const start = Date.now();
          const projects = await api.getProjects();
          return { 
            duration: Date.now() - start,
            count: projects.length 
          };
        }
      },
      {
        name: "审计任务查询",
        test: async () => {
          const start = Date.now();
          const tasks = await api.getAuditTasks();
          return { 
            duration: Date.now() - start,
            count: tasks.length 
          };
        }
      },
      {
        name: "用户配置查询",
        test: async () => {
          const start = Date.now();
          const count = await api.getProfilesCount();
          return { 
            duration: Date.now() - start,
            count 
          };
        }
      }
    ];

    for (const { name, test } of tests) {
      try {
        // 添加pending状态
        setResults(prev => [...prev, { name, status: 'pending', message: '测试中...' }]);
        
        const result = await test();
        
        // 更新为成功状态
        setResults(prev => prev.map(r => 
          r.name === name 
            ? { 
                name, 
                status: 'success', 
                message: `测试通过 (${result.duration}ms)${result.count !== undefined ? ` - 数据量: ${result.count}` : ''}`,
                duration: result.duration
              }
            : r
        ));
      } catch (error: any) {
        // 更新为错误状态
        setResults(prev => prev.map(r => 
          r.name === name 
            ? { 
                name, 
                status: 'error', 
                message: `测试失败: ${error.message || '未知错误'}`
              }
            : r
        ));
      }
      
      // 添加延迟避免过快执行
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setTesting(false);
    
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = tests.length;
    
    if (successCount === totalCount) {
      toast.success("所有数据库测试通过！");
    } else {
      toast.error(`${totalCount - successCount} 个测试失败`);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">通过</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">失败</Badge>;
      case 'pending':
        return <Badge className="bg-blue-100 text-blue-800">测试中</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="w-5 h-5 mr-2" />
          数据库连接测试
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            测试数据库连接状态和基本功能
          </p>
          <Button 
            onClick={runTests} 
            disabled={testing}
            size="sm"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                测试中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                开始测试
              </>
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <p className="font-medium text-sm">{result.name}</p>
                    <p className="text-xs text-gray-500">{result.message}</p>
                  </div>
                </div>
                {getStatusBadge(result.status)}
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && !testing && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              测试完成！成功: {results.filter(r => r.status === 'success').length} / 
              总计: {results.length}
            </AlertDescription>
          </Alert>
        )}

        {results.length === 0 && !testing && (
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              点击"开始测试"按钮来检查数据库连接状态
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}