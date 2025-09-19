import React from "react";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-200">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* ================= 关于我们 ================= */}
          <div>
            {/* 标题：改成你们项目的“关于我们” */}
            <h3 className="text-lg font-semibold text-amber-800 mb-4">
              {/* 关于我们 */}
            </h3>
            <p className="text-gray-600">
              {/* 在这里填写“关于我们”的介绍，比如：致力于xxx，让xxx更加xxx */}
            </p>
          </div>

          {/* ================= 联系信息 ================= */}
          <div>
            {/* 标题：联系信息 */}
            <h3 className="text-lg font-semibold text-amber-800 mb-4">
              {/* 联系信息 */}
            </h3>
            <div className="text-gray-600 space-y-2">
              <p>
                {/* 地址：XXX省XXX市XXX区XXX路XXX号 */}
              </p>
              <p>
                {/* 电话：010-XXXXXXX */}
              </p>
              <p>
                {/* 邮箱：info@example.com */}
              </p>
            </div>
          </div>

          {/* ================= 开放时间 / 其他信息 / 也可删除 ================= */}
          <div>
            {/* 标题：可改成“开放时间”或者“服务时间” */}
            <h3 className="text-lg font-semibold text-amber-800 mb-4">
              {/* 开放时间 */}
            </h3>
            <div className="text-gray-600 space-y-2">
              <p>
                {/* 周一至周五：9:00-18:00 */}
              </p>
              <p>
                {/* 周末及法定节假日请注意公告 */}
              </p>
              <p>
                {/* 其他说明，比如“需要提前预约” */}
              </p>
            </div>
          </div>
        </div>

        {/* ================= 版权区域 ================= */}
        <div className="mt-8 pt-8 border-t border-amber-200 text-center text-gray-600">
          <p>
            {/* © {currentYear} 你的公司或组织名称 */}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
