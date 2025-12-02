<?php
namespace Platform\Plugins\Trading\Src\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Platform\Plugins\Trading\Src\Repositories\Eloquent\KnowledgeRepository;
use Platform\Plugins\Trading\Src\Models\Knowledge;

class KnowledgeController extends Controller
{
    protected $knowledgeRepository;

    public function __construct(KnowledgeRepository $knowledgeRepository)
    {
        $this->knowledgeRepository = $knowledgeRepository;
    }

    public function index(Request $request)
    {
        $filter = $request->input('filter', []);
        $select = $request->input('select', ['*']);
        $perPage = $request->input('per_page', 15);

        $knowledges = $this->knowledgeRepository->findAll($filter, $select, $perPage);

        return response()->json($knowledges);
    }

    public function show(string $id)
    {
        $knowledge = $this->knowledgeRepository->find($id);
        if ($knowledge) {
            return response()->json($knowledge);
        }
        return response()->json(['error' => 'Knowledge not found'], 404);
    }

    public function store(Request $request)
    {
        $data = $request->only(['title', 'content', 'tags']);
        $knowledge = $this->knowledgeRepository->create($data);
        return response()->json($knowledge, 201);
    }

    public function update(Request $request, string $id)
    {
        $data = $request->only(['title', 'content', 'tags']);
        $knowledge = $this->knowledgeRepository->update($id, $data);
        if ($knowledge) {
            return response()->json($knowledge);
        }
        return response()->json(['error' => 'Knowledge not found'], 404);
    }

    public function destroy(string $id)
    {
        $deleted = $this->knowledgeRepository->delete($id);
        if ($deleted) {
            return response()->json(['message' => 'Knowledge deleted successfully']);
        }
        return response()->json(['error' => 'Knowledge not found'], 404);
    }
}