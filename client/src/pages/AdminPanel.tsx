import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Edit2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    displayName: "",
    modelName: "",
    apiUrl: "",
    apiKey: "",
    status: "active" as "active" | "inactive",
  });

  // Fetch models
  const { data: models = [], refetch } = trpc.models.list.useQuery();

  // Create model mutation
  const createModelMutation = trpc.models.create.useMutation({
    onSuccess: () => {
      refetch();
      resetForm();
      setIsOpen(false);
      toast.success("模型添加成功");
    },
    onError: (error) => {
      toast.error(`添加失败: ${error.message}`);
    },
  });

  // Update model mutation
  const updateModelMutation = trpc.models.update.useMutation({
    onSuccess: () => {
      refetch();
      resetForm();
      setIsOpen(false);
      toast.success("模型更新成功");
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  // Delete model mutation
  const deleteModelMutation = trpc.models.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("模型删除成功");
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      displayName: "",
      modelName: "",
      apiUrl: "",
      apiKey: "",
      status: "active",
    });
    setEditingId(null);
  };

  const handleEdit = (model: any) => {
    setFormData({
      displayName: model.displayName,
      modelName: model.modelName,
      apiUrl: model.apiUrl,
      apiKey: model.apiKey,
      status: model.status,
    });
    setEditingId(model.id);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName || !formData.modelName || !formData.apiUrl || !formData.apiKey) {
      toast.error("请填写所有必填字段");
      return;
    }

    if (editingId) {
      await updateModelMutation.mutateAsync({
        id: editingId,
        ...formData,
      });
    } else {
      await createModelMutation.mutateAsync(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("确定要删除这个模型吗？")) {
      deleteModelMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">模型管理</h1>
          <p className="text-muted-foreground">管理蛋糕🍰ai 的所有模型配置</p>
        </div>

        {/* Add Model Button */}
        <div className="mb-6">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm();
                  setIsOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                添加模型
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? "编辑模型" : "添加新模型"}</DialogTitle>
                <DialogDescription>
                  {editingId ? "编辑模型配置信息" : "填写模型配置信息"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">显示名称</label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                    placeholder="例如: GPT-4"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">模型名称</label>
                  <Input
                    value={formData.modelName}
                    onChange={(e) =>
                      setFormData({ ...formData, modelName: e.target.value })
                    }
                    placeholder="例如: gpt-4-turbo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">API 地址</label>
                  <Input
                    value={formData.apiUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, apiUrl: e.target.value })
                    }
                    placeholder="例如: https://api.openai.com/v1/chat/completions"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">API 密钥</label>
                  <Input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, apiKey: e.target.value })
                    }
                    placeholder="输入 API 密钥"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">状态</label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        status: value as "active" | "inactive",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">启用</SelectItem>
                      <SelectItem value="inactive">禁用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    className="flex-1"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createModelMutation.isPending || updateModelMutation.isPending
                    }
                    className="flex-1"
                  >
                    {editingId ? "更新" : "添加"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Models Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>显示名称</TableHead>
                  <TableHead>模型名称</TableHead>
                  <TableHead>API 地址</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      暂无模型配置
                    </TableCell>
                  </TableRow>
                ) : (
                  models.map((model: any) => (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">{model.displayName}</TableCell>
                      <TableCell>{model.modelName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                        {model.apiUrl}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            model.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {model.status === "active" ? "启用" : "禁用"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(model)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(model.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 text-sm text-muted-foreground">
          <p>共 {models.length} 个模型</p>
        </div>
      </div>
    </div>
  );
}
