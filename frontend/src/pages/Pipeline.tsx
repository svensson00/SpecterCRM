import PipelineBoard from '../components/PipelineBoard';

export default function Pipeline() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">Deal Pipeline</h1>
        <p className="text-sm text-gray-400 mt-1">Drag and drop deals to move them between stages</p>
      </div>
      <PipelineBoard />
    </div>
  );
}
