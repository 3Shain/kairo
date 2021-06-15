<script lang="ts" kairo>
    import {mut} from 'kairo';

    const [count,setCount] = mut(12345);
</script>
<div>{$count}</div>